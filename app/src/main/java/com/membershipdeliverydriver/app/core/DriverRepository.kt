package com.membershipdeliverydriver.app.core

import android.net.Uri
import androidx.core.content.ContextCompat
import android.Manifest
import android.location.LocationManager
import com.membershipdeliverydriver.app.BuildConfig
import android.graphics.BitmapFactory
import java.io.ByteArrayOutputStream
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.OffsetDateTime
import java.time.format.DateTimeFormatter
import java.time.temporal.TemporalAdjusters
import kotlin.math.asin
import kotlin.math.cos
import kotlin.math.pow
import kotlin.math.sin
import kotlin.math.sqrt

interface DriverRepository {
    suspend fun login(form: LoginForm): ApiResult<DriverProfile>
    suspend fun restoreSession(): ApiResult<DriverProfile>?
    suspend fun submitRegistration(form: RegistrationForm): ApiResult<ApprovalStatus>
    suspend fun toggleAvailability(current: DriverAvailability): DriverAvailability
    suspend fun loadAvailableOrders(): List<Order>
    suspend fun loadOrders(): List<Order>
    suspend fun loadEarnings(): List<EarningEntry>
    suspend fun loadCompletedOrders(filter: HistoryRange, page: Int, pageSize: Int = 10): PagedOrdersResult
    suspend fun acceptOrder(orderId: String): ApiResult<Order>
    suspend fun markOrderPickedUp(orderId: String): ApiResult<Order>
    suspend fun attachProofOfDelivery(orderId: String, uri: Uri): ApiResult<Order>
    suspend fun cancelOrder(
        orderId: String,
        reason: String,
        otherReason: String?,
        handling: CancelHandling,
    ): ApiResult<Order>
    suspend fun reportIssue(orderId: String, note: String): ApiResult<Order>
    suspend fun logout()
}

class SupabaseDriverRepository : DriverRepository {
    private val client = OkHttpClient()
    private var session: AuthSession? = null
    private var currentDriver: DriverProfile? = null
    private var currentAuthUserId: String? = null
    private var cachedAvailableOrders: List<Order> = emptyList()
    private var cachedOrders: List<Order> = emptyList()

    override suspend fun login(form: LoginForm): ApiResult<DriverProfile> = withContext(Dispatchers.IO) {
        try {
            val email = authEmailFromPhone(form.phone)
            val authPassword = authPasswordFromPin(form.password)
            val payload = JSONObject()
                .put("email", email)
                .put("password", authPassword)
                .toString()

            val authJson = requestJson(
                path = "/auth/v1/token?grant_type=password",
                method = "POST",
                token = BuildConfig.SUPABASE_ANON_KEY,
                body = payload,
            )

            val accessToken = authJson.getString("access_token")
            val refreshToken = authJson.optString("refresh_token", "")
            val expiresIn = authJson.optLong("expires_in", 3600)
            val userId = authJson.getJSONObject("user").getString("id")

            session = AuthSession(
                accessToken = accessToken,
                refreshToken = refreshToken,
                expiresInSeconds = expiresIn,
            )
            DriverSessionStore.saveSession(
                AppContextHolder.requireContext(),
                accessToken,
                refreshToken,
            )
            currentAuthUserId = userId

            val profileArray = requestArray(
                path = "/rest/v1/driver_profiles?select=id,full_name,phone,approval_status,availability&auth_user_id=eq.${urlEncode(userId)}",
                token = accessToken,
            )

            if (profileArray.length() == 0) {
                return@withContext ApiResult.Failure("找不到騎手資料，請先完成註冊。")
            }

            val profile = profileArray.getJSONObject(0).toDriverProfile()
            currentDriver = profile

            return@withContext when (profile.approvalStatus) {
                ApprovalStatus.PENDING_APPROVAL -> ApiResult.Failure("帳號仍在審核中，請等待後台批准。")
                ApprovalStatus.REJECTED -> ApiResult.Failure("帳號已被拒絕，請聯絡後台重新提交資料。")
                ApprovalStatus.APPROVED -> {
                    runCatching {
                        FcmRegistrationManager.syncCurrentToken(accessToken)
                    }
                    ApiResult.Success(profile)
                }
            }
        } catch (error: Exception) {
            ApiResult.Failure(error.message ?: "登入失敗。")
        }
    }

    override suspend fun restoreSession(): ApiResult<DriverProfile>? = withContext(Dispatchers.IO) {
        val context = AppContextHolder.requireContext()
        val refreshToken = DriverSessionStore.getRefreshToken(context) ?: return@withContext null

        try {
            val authJson = requestJson(
                path = "/auth/v1/token?grant_type=refresh_token",
                method = "POST",
                token = BuildConfig.SUPABASE_ANON_KEY,
                body = JSONObject().put("refresh_token", refreshToken).toString(),
            )

            val accessToken = authJson.getString("access_token")
            val nextRefreshToken = authJson.optString("refresh_token", refreshToken)
            val expiresIn = authJson.optLong("expires_in", 3600)
            val userId = authJson.getJSONObject("user").getString("id")

            session = AuthSession(
                accessToken = accessToken,
                refreshToken = nextRefreshToken,
                expiresInSeconds = expiresIn,
            )
            currentAuthUserId = userId
            DriverSessionStore.saveSession(context, accessToken, nextRefreshToken)

            val profileArray = requestArray(
                path = "/rest/v1/driver_profiles?select=id,full_name,phone,approval_status,availability&auth_user_id=eq.${urlEncode(userId)}",
                token = accessToken,
            )
            if (profileArray.length() == 0) {
                DriverSessionStore.clear(context)
                session = null
                currentAuthUserId = null
                return@withContext null
            }

            val profile = profileArray.getJSONObject(0).toDriverProfile()
            currentDriver = profile
            return@withContext when (profile.approvalStatus) {
                ApprovalStatus.APPROVED -> ApiResult.Success(profile)
                ApprovalStatus.PENDING_APPROVAL -> ApiResult.Failure("帳號仍在審核中，請等待後台批准。")
                ApprovalStatus.REJECTED -> ApiResult.Failure("帳號已被拒絕，請聯絡後台重新提交資料。")
            }
        } catch (_: Exception) {
            DriverSessionStore.clear(context)
            session = null
            currentDriver = null
            currentAuthUserId = null
            return@withContext null
        }
    }

    override suspend fun cancelOrder(
        orderId: String,
        reason: String,
        otherReason: String?,
        handling: CancelHandling,
    ): ApiResult<Order> = withContext(Dispatchers.IO) {
        val token = session?.accessToken ?: return@withContext ApiResult.Failure("請先登入。")
        val driverId = currentDriver?.id ?: return@withContext ApiResult.Failure("找不到騎手資料。")

        try {
            requestArray(
                path = "/rest/v1/order_events",
                method = "POST",
                token = token,
                body = JSONObject()
                    .put("order_id", orderId)
                    .put("event_type", "issue_reported")
                    .put("actor_type", "driver")
                    .put("actor_driver_id", driverId)
                    .put(
                        "payload",
                        JSONObject()
                            .put("cancel_reason", reason)
                            .put("cancel_other_reason", otherReason ?: "")
                            .put(
                                "cancel_handling",
                                when (handling) {
                                    CancelHandling.RETURN_TO_SHOP -> "return_to_shop"
                                    CancelHandling.NOT_RETURNING -> "not_returning"
                                }
                            )
                            .put("note", "騎手取消配送")
                    )
                    .toString(),
                prefer = "return=representation",
            )

            requestArray(
                path = "/rest/v1/orders?id=eq.${urlEncode(orderId)}",
                method = "PATCH",
                token = token,
                body = JSONObject().put("status", "canceled").toString(),
                prefer = "return=representation",
            )

            val updatedOrder = (cachedOrders.firstOrNull { it.id == orderId } ?: loadActiveOrderById(token, orderId))
                ?.copy(
                    status = OrderStatus.CANCELED,
                    cancelReason = reason,
                    cancelOtherReason = otherReason,
                    cancelHandling = handling,
                )

            if (updatedOrder != null) {
                cachedOrders = cachedOrders.map { if (it.id == orderId) updatedOrder else it }
                ApiResult.Success(updatedOrder)
            } else {
                ApiResult.Failure("找不到訂單。")
            }
        } catch (error: Exception) {
            ApiResult.Failure(error.message ?: "取消訂單失敗。")
        }
    }

    override suspend fun submitRegistration(form: RegistrationForm): ApiResult<ApprovalStatus> = withContext(Dispatchers.IO) {
        try {
            ensureRegistrationAccount(form)

            val email = authEmailFromPhone(form.phone)
            val authPassword = authPasswordFromPin(form.password)
            val authJson = loginForRegistration(email, authPassword)

            val accessToken = authJson.optString("access_token", "")
            val userJson = authJson.optJSONObject("user")
                ?: throw IllegalStateException("註冊成功，但沒有取得使用者資料。")
            val userId = userJson.getString("id")

            if (accessToken.isBlank()) {
                return@withContext ApiResult.Failure(
                    "註冊資料已送出，但目前無法自動完成開通，請稍後再試。"
                )
            }

            val existingProfileArray = requestArray(
                path = "/rest/v1/driver_profiles?select=id&auth_user_id=eq.${urlEncode(userId)}",
                token = accessToken,
            )
            val driverId =
                if (existingProfileArray.length() > 0) {
                    val existingDriverId = existingProfileArray.getJSONObject(0).getString("id")
                    requestArray(
                        path = "/rest/v1/driver_profiles?id=eq.${urlEncode(existingDriverId)}",
                        method = "PATCH",
                        token = accessToken,
                        body = JSONObject()
                            .put("full_name", form.fullName)
                            .put("phone", form.phone)
                            .put("vehicle_type", "電單車")
                            .put("approval_status", "pending_review")
                            .put("availability", "offline")
                            .toString(),
                        prefer = "return=representation",
                    )
                    existingDriverId
                } else {
                    val profilePayload = JSONObject()
                        .put("auth_user_id", userId)
                        .put("full_name", form.fullName)
                        .put("phone", form.phone)
                        .put("vehicle_type", "電單車")
                        .put("approval_status", "pending_review")
                        .put("availability", "offline")
                        .toString()

                    val profileArray = requestArray(
                        path = "/rest/v1/driver_profiles",
                        method = "POST",
                        token = accessToken,
                        body = profilePayload,
                        prefer = "return=representation",
                    )
                    profileArray.getJSONObject(0).getString("id")
                }

            val existingApplicationArray = requestArray(
                path = "/rest/v1/driver_applications?select=id&driver_id=eq.${urlEncode(driverId)}&order=created_at.desc&limit=1",
                token = accessToken,
            )
            if (existingApplicationArray.length() == 0) {
                requestArray(
                    path = "/rest/v1/driver_applications",
                    method = "POST",
                    token = accessToken,
                    body = JSONObject().put("driver_id", driverId).toString(),
                    prefer = "return=representation",
                )
            }

            val selfiePath = uploadToStorage("driver-documents", "${userId}/selfie.jpg", form.selfie.uri!!, accessToken)
            val macauIdPath = uploadToStorage("driver-documents", "${userId}/macau-id.jpg", form.macauId.uri!!, accessToken)
            val licencePath = uploadToStorage("driver-documents", "${userId}/driving-licence.jpg", form.drivingLicence.uri!!, accessToken)

            requestArray(
                path = "/rest/v1/driver_documents?driver_id=eq.${urlEncode(driverId)}",
                method = "DELETE",
                token = accessToken,
            )

            val documentsPayload = JSONArray()
                .put(JSONObject().put("driver_id", driverId).put("document_type", "selfie").put("storage_path", selfiePath))
                .put(JSONObject().put("driver_id", driverId).put("document_type", "macau_id").put("storage_path", macauIdPath))
                .put(JSONObject().put("driver_id", driverId).put("document_type", "driving_licence").put("storage_path", licencePath))
                .toString()

            requestArray(
                path = "/rest/v1/driver_documents",
                method = "POST",
                token = accessToken,
                body = documentsPayload,
                prefer = "return=representation",
            )

            ApiResult.Success(ApprovalStatus.PENDING_APPROVAL)
        } catch (error: Exception) {
            val rawMessage = error.message.orEmpty()
            val userMessage = when {
                rawMessage.contains("over_email_rate_limit", ignoreCase = true) ||
                    rawMessage.contains("email rate limit", ignoreCase = true) ->
                    "目前註冊請求太多，請稍等幾分鐘後再試。"
                else -> rawMessage.ifBlank { "提交註冊失敗。" }
            }
            ApiResult.Failure(userMessage)
        }
    }

    override suspend fun toggleAvailability(current: DriverAvailability): DriverAvailability = withContext(Dispatchers.IO) {
        val token = session?.accessToken ?: return@withContext current
        val driverId = currentDriver?.id ?: return@withContext current
        val next = if (current == DriverAvailability.ONLINE) DriverAvailability.OFFLINE else DriverAvailability.ONLINE

        requestArray(
            path = "/rest/v1/driver_profiles?id=eq.${urlEncode(driverId)}",
            method = "PATCH",
            token = token,
            body = JSONObject().put("availability", next.toApiValue()).toString(),
            prefer = "return=representation",
        )

        requestArray(
            path = "/rest/v1/driver_shifts",
            method = "POST",
            token = token,
            body = JSONObject()
                .put("driver_id", driverId)
                .put("availability", next.toApiValue())
                .toString(),
            prefer = "return=representation",
        )

        currentDriver = currentDriver?.copy(availability = next)
        next
    }

    override suspend fun loadAvailableOrders(): List<Order> = withContext(Dispatchers.IO) {
        val token = session?.accessToken ?: return@withContext emptyList()
        val driverId = currentDriver?.id ?: return@withContext emptyList()

        val latestDriverLocation = loadLatestDriverLocation(token, driverId)
        val ordersArray = requestArray(
            path = "/rest/v1/orders?select=id,external_order_id,status,assigned_fee_mop,promised_at,shop_id,customer_id&status=eq.new&order=created_at.asc",
            token = token,
        )

        val mappedOrders = mapOrders(token, ordersArray, latestDriverLocation)
        cachedAvailableOrders = mappedOrders
        mappedOrders
    }

    override suspend fun loadOrders(): List<Order> = withContext(Dispatchers.IO) {
        val token = session?.accessToken ?: return@withContext emptyList()
        val driverId = currentDriver?.id ?: return@withContext emptyList()

        val assignmentArray = requestArray(
            path = "/rest/v1/order_assignments?select=order_id,accepted_at,canceled_at&driver_id=eq.${urlEncode(driverId)}&canceled_at=is.null",
            token = token,
        )

        if (assignmentArray.length() == 0) {
            cachedOrders = emptyList()
            return@withContext emptyList()
        }

        val orderIds = buildList {
            for (index in 0 until assignmentArray.length()) {
                add(assignmentArray.getJSONObject(index).getString("order_id"))
            }
        }
        val orderFilter = orderIds.joinToString(",") { "\"$it\"" }
        val latestDriverLocation = loadLatestDriverLocation(token, driverId)
        val ordersArray = requestArray(
            path = "/rest/v1/orders?select=id,external_order_id,status,assigned_fee_mop,promised_at,shop_id,customer_id&order=promised_at.asc&id=in.($orderFilter)&status=not.eq.delivered",
            token = token,
        )

        val mappedOrders = mapOrders(token, ordersArray, latestDriverLocation)
        cachedOrders = mappedOrders
        mappedOrders
    }

    override suspend fun loadCompletedOrders(
        filter: HistoryRange,
        page: Int,
        pageSize: Int,
    ): PagedOrdersResult = withContext(Dispatchers.IO) {
        val token = session?.accessToken ?: return@withContext PagedOrdersResult(emptyList(), page, false)
        val driverId = currentDriver?.id ?: return@withContext PagedOrdersResult(emptyList(), page, false)
        val offset = page * pageSize

        val deliveredEvents = requestArray(
            path = buildString {
                append("/rest/v1/order_events?select=order_id,created_at")
                append("&actor_driver_id=eq.${urlEncode(driverId)}")
                append("&event_type=eq.delivered")
                append(historyRangeQuery(filter, "created_at"))
                append("&order=created_at.desc")
                append("&limit=$pageSize")
                append("&offset=$offset")
            },
            token = token,
        )

        if (deliveredEvents.length() == 0) {
            return@withContext PagedOrdersResult(emptyList(), page, false)
        }

        val orderIds = buildList {
            for (index in 0 until deliveredEvents.length()) {
                add(deliveredEvents.getJSONObject(index).getString("order_id"))
            }
        }
        val latestDriverLocation = loadLatestDriverLocation(token, driverId)
        val ordersArray = requestArray(
            path = "/rest/v1/orders?select=id,external_order_id,status,assigned_fee_mop,promised_at,shop_id,customer_id&id=in.(${orderIds.joinToString(",") { "\"$it\"" }})&order=promised_at.desc",
            token = token,
        )

        PagedOrdersResult(
            items = mapOrders(token, ordersArray, latestDriverLocation).sortedByDescending { it.deliveredAt ?: "" },
            page = page,
            hasMore = deliveredEvents.length() == pageSize,
        )
    }

    override suspend fun acceptOrder(orderId: String): ApiResult<Order> = withContext(Dispatchers.IO) {
        val token = session?.accessToken ?: return@withContext ApiResult.Failure("請先登入。")
        val driverId = currentDriver?.id ?: return@withContext ApiResult.Failure("找不到騎手資料。")

        try {
            val now = OffsetDateTime.now().toString()
            requestArray(
                path = "/rest/v1/order_assignments",
                method = "POST",
                token = token,
                body = JSONObject()
                    .put("order_id", orderId)
                    .put("driver_id", driverId)
                    .put("accepted_at", now)
                    .toString(),
                prefer = "return=representation",
            )

            requestArray(
                path = "/rest/v1/orders?id=eq.${urlEncode(orderId)}",
                method = "PATCH",
                token = token,
                body = JSONObject().put("status", "accepted").toString(),
                prefer = "return=representation",
            )

            requestArray(
                path = "/rest/v1/order_events",
                method = "POST",
                token = token,
                body = JSONObject()
                    .put("order_id", orderId)
                    .put("event_type", "accepted")
                    .put("actor_type", "driver")
                    .put("actor_driver_id", driverId)
                    .put("payload", JSONObject().put("note", "騎手已接單"))
                    .toString(),
                prefer = "return=representation",
            )

            runCatching {
                triggerCallbackDispatch(
                    orderId = orderId,
                    eventType = "accepted",
                    accessToken = token,
                )
            }

            val acceptedOrder = (cachedAvailableOrders.firstOrNull { it.id == orderId } ?: cachedOrders.firstOrNull { it.id == orderId })
                ?.copy(status = OrderStatus.HEADING_TO_SHOP)

            if (acceptedOrder != null) {
                cachedAvailableOrders = cachedAvailableOrders.filterNot { it.id == orderId }
                cachedOrders = (cachedOrders.filterNot { it.id == orderId } + acceptedOrder)
                    .sortedBy { it.etaMinutes }
                ApiResult.Success(acceptedOrder)
            } else {
                ApiResult.Failure("已接單，但暫時無法更新畫面，請重新整理。")
            }
        } catch (error: Exception) {
            ApiResult.Failure(error.message ?: "接單失敗。")
        }
    }

    override suspend fun loadEarnings(): List<EarningEntry> = withContext(Dispatchers.IO) {
        val delivered = loadAllDeliveredOrders()
        delivered.mapNotNull { order ->
            val completedAt = order.deliveredAt?.let {
                runCatching { OffsetDateTime.parse(it).toLocalDateTime() }.getOrNull()
            } ?: return@mapNotNull null

            EarningEntry(
                id = "earn-${order.id}",
                title = "${order.shop.label} → ${order.customer.label}",
                amountMop = order.totalAmountMop,
                completedAt = completedAt,
            )
        }
    }

    override suspend fun markOrderPickedUp(orderId: String): ApiResult<Order> = withContext(Dispatchers.IO) {
        val token = session?.accessToken ?: return@withContext ApiResult.Failure("請先登入。")
        val driverId = currentDriver?.id ?: return@withContext ApiResult.Failure("找不到騎手資料。")

        try {
            val now = OffsetDateTime.now().toString()

            requestArray(
                path = "/rest/v1/order_events",
                method = "POST",
                token = token,
                body = JSONObject()
                    .put("order_id", orderId)
                    .put("event_type", "picked_up")
                    .put("actor_type", "driver")
                    .put("actor_driver_id", driverId)
                    .put("payload", JSONObject().put("note", "騎手已取貨"))
                    .toString(),
                prefer = "return=representation",
            )

            requestArray(
                path = "/rest/v1/orders?id=eq.${urlEncode(orderId)}",
                method = "PATCH",
                token = token,
                body = JSONObject().put("status", "picked_up").toString(),
                prefer = "return=representation",
            )

            runCatching {
                triggerCallbackDispatch(
                    orderId = orderId,
                    eventType = "picked_up",
                    accessToken = token,
                )
            }

            val updatedOrder = cachedOrders.firstOrNull { it.id == orderId }?.copy(
                status = OrderStatus.PICKED_UP,
                pickedUpAt = now,
            )

            if (updatedOrder != null) {
                cachedOrders = cachedOrders.map { if (it.id == orderId) updatedOrder else it }
                ApiResult.Success(updatedOrder)
            } else {
                ApiResult.Failure("找不到訂單。")
            }
        } catch (error: Exception) {
            ApiResult.Failure(error.message ?: "更新取貨狀態失敗。")
        }
    }

    override suspend fun attachProofOfDelivery(orderId: String, uri: Uri): ApiResult<Order> = withContext(Dispatchers.IO) {
        val token = session?.accessToken ?: return@withContext ApiResult.Failure("請先登入。")
        val driverId = currentDriver?.id ?: return@withContext ApiResult.Failure("找不到騎手資料。")
        val authUserId = currentAuthUserId ?: return@withContext ApiResult.Failure("找不到登入身份。")

        try {
            val deliveredAt = OffsetDateTime.now().toString()
            requestArray(
                path = "/rest/v1/order_events",
                method = "POST",
                token = token,
                body = JSONObject()
                    .put("order_id", orderId)
                    .put("event_type", "delivered")
                    .put("actor_type", "driver")
                    .put("actor_driver_id", driverId)
                    .put("payload", JSONObject().put("note", "騎手已完成訂單，照片背景上傳中"))
                    .toString(),
                prefer = "return=representation",
            )

            requestArray(
                path = "/rest/v1/orders?id=eq.${urlEncode(orderId)}",
                method = "PATCH",
                token = token,
                body = JSONObject().put("status", "delivered").toString(),
                prefer = "return=representation",
            )

            runCatching {
                triggerCallbackDispatch(
                    orderId = orderId,
                    eventType = "delivered",
                    accessToken = token,
                )
            }

            val existingOrder = cachedOrders.firstOrNull { it.id == orderId } ?: loadActiveOrderById(token, orderId)
            var updatedOrder = existingOrder?.copy(
                status = OrderStatus.DELIVERED,
                deliveredAt = deliveredAt,
                proofOfDeliveryUri = uri,
            )

            if (updatedOrder == null) {
                updatedOrder = Order(
                    id = orderId,
                    externalOrderId = orderId,
                    status = OrderStatus.DELIVERED,
                    shop = LocationPoint("", "", 0.0, 0.0, "", ""),
                    customer = LocationPoint("", "", 0.0, 0.0, "", ""),
                    customerNote = "",
                    etaMinutes = 0,
                    deliveryDeadlineText = "",
                    promisedAt = null,
                    distanceKm = 0.0,
                    totalAmountMop = 0.0,
                    items = emptyList(),
                    deliveredAt = deliveredAt,
                    proofOfDeliveryUri = uri,
                )
            }

            cachedOrders = cachedOrders.filterNot { it.id == orderId }

            val storagePath = uploadToStorage(
                bucket = "delivery-proofs",
                objectPath = "${authUserId}/order-${orderId}-proof.jpg",
                uri = uri,
                accessToken = token,
            )

            requestArray(
                path = "/rest/v1/delivery_proofs",
                method = "POST",
                token = token,
                body = JSONObject()
                    .put("order_id", orderId)
                    .put("driver_id", driverId)
                    .put("storage_path", storagePath)
                    .put("proof_type", "proof_of_delivery")
                    .toString(),
                prefer = "return=representation",
            )

            updatedOrder = updatedOrder?.copy(
                proofOfDeliveryPath = storagePath,
                proofOfDeliveryUrl = createSignedProofUrl(storagePath, token) ?: proofPublicUrl(storagePath),
            )

            val finalOrder = updatedOrder
                ?: throw IllegalStateException("找不到已完成的訂單資料。")

            ApiResult.Success(finalOrder)
        } catch (error: Exception) {
            ApiResult.Failure(error.message ?: "上傳送達證明失敗。")
        }
    }

    override suspend fun reportIssue(orderId: String, note: String): ApiResult<Order> = withContext(Dispatchers.IO) {
        val token = session?.accessToken ?: return@withContext ApiResult.Failure("請先登入。")
        val driverId = currentDriver?.id ?: return@withContext ApiResult.Failure("找不到騎手資料。")

        try {
            requestArray(
                path = "/rest/v1/order_events",
                method = "POST",
                token = token,
                body = JSONObject()
                    .put("order_id", orderId)
                    .put("event_type", "issue_reported")
                    .put("actor_type", "driver")
                    .put("actor_driver_id", driverId)
                    .put("payload", JSONObject().put("note", note))
                    .toString(),
                prefer = "return=representation",
            )

            runCatching {
                triggerCallbackDispatch(
                    orderId = orderId,
                    eventType = "exception_reported",
                    accessToken = token,
                    note = note,
                    action = "pending_review",
                )
            }

            val updatedOrder = cachedOrders.firstOrNull { it.id == orderId }?.copy(
                status = OrderStatus.ISSUE_REPORTED,
                issueNote = note,
            )

            if (updatedOrder != null) {
                cachedOrders = cachedOrders.map { if (it.id == orderId) updatedOrder else it }
                ApiResult.Success(updatedOrder)
            } else {
                ApiResult.Failure("找不到訂單。")
            }
        } catch (error: Exception) {
            ApiResult.Failure(error.message ?: "回報異常失敗。")
        }
    }

    override suspend fun logout() = withContext(Dispatchers.IO) {
        session = null
        currentDriver = null
        currentAuthUserId = null
        cachedAvailableOrders = emptyList()
        cachedOrders = emptyList()
        DriverSessionStore.clear(AppContextHolder.requireContext())
    }

    private fun authEmailFromPhone(phone: String): String {
        val normalized = normalizePhone(phone)
        return "${normalized}@driver.membership.local"
    }

    private fun authPasswordFromPin(pin: String): String {
        return "DriverPin#$pin@2026"
    }

    private fun loginForRegistration(email: String, authPassword: String): JSONObject {
        val payload = JSONObject()
            .put("email", email)
            .put("password", authPassword)
            .toString()

        return requestJson(
            path = "/auth/v1/token?grant_type=password",
            method = "POST",
            token = BuildConfig.SUPABASE_ANON_KEY,
            body = payload,
        )
    }

    private fun ensureRegistrationAccount(form: RegistrationForm) {
        if (BuildConfig.API_BASE_URL.contains("your-api.example.com")) {
            throw IllegalStateException("目前無法註冊，請稍後再試。")
        }

        val baseUrl = BuildConfig.API_BASE_URL.trimEnd('/')
        val body = JSONObject()
            .put("fullName", form.fullName)
            .put("phone", form.phone)
            .put("pin", form.password)
            .toString()

        val request = Request.Builder()
            .url("$baseUrl/api/mobile/drivers/register")
            .post(body.toRequestBody("application/json".toMediaType()))
            .addHeader("Content-Type", "application/json")
            .build()

        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) {
                val raw = extractErrorMessage(response.body?.string().orEmpty())
                val userMessage = when {
                    raw.contains("SUPABASE", ignoreCase = true) ||
                        raw.contains("service role", ignoreCase = true) ->
                        "註冊服務暫時無法使用，請稍後再試。"
                    raw.contains("rate limit", ignoreCase = true) ||
                        raw.contains("too many", ignoreCase = true) ->
                        "目前註冊請求太多，請稍等幾分鐘後再試。"
                    else -> raw
                }
                throw IllegalStateException(userMessage)
            }
        }
    }

    private fun isSiteBApiConfigured(): Boolean {
        return !BuildConfig.API_BASE_URL.contains("your-api.example.com")
    }

    private fun triggerCallbackDispatch(
        orderId: String,
        eventType: String,
        accessToken: String,
        note: String? = null,
        action: String? = null,
    ) {
        if (!isSiteBApiConfigured()) return

        val baseUrl = BuildConfig.API_BASE_URL.trimEnd('/')
        val requestBody = JSONObject()
            .put("eventType", eventType)
            .apply {
                if (!note.isNullOrBlank()) put("note", note)
                if (!action.isNullOrBlank()) put("action", action)
            }
            .toString()

        val request = Request.Builder()
            .url("$baseUrl/api/mobile/orders/$orderId/callback")
            .post(requestBody.toRequestBody("application/json".toMediaType()))
            .addHeader("Content-Type", "application/json")
            .addHeader("x-supabase-access-token", accessToken)
            .build()

        client.newCall(request).execute().use { /* best-effort callback dispatch */ }
    }

    private fun normalizePhone(phone: String): String {
        val digits = phone.filter { it.isDigit() }
        return if (digits.startsWith("853")) digits else "853$digits"
    }

    private fun jsonArrayToMap(array: JSONArray, key: (JSONObject) -> String): Map<String, JSONObject> {
        val map = mutableMapOf<String, JSONObject>()
        for (index in 0 until array.length()) {
            val item = array.getJSONObject(index)
            map[key(item)] = item
        }
        return map
    }

    private fun calculateEtaMinutes(promisedAt: String): Int {
        if (promisedAt.isBlank()) return 0
        return runCatching {
            val target = OffsetDateTime.parse(promisedAt)
            val minutes = java.time.Duration.between(OffsetDateTime.now(), target).toMinutes()
            if (minutes < 0) 0 else minutes.toInt()
        }.getOrDefault(0)
    }

    private fun formatDeadline(promisedAt: String): String {
        if (promisedAt.isBlank()) return "時間待定"
        return runCatching {
            DateTimeFormatter.ofPattern("HH:mm").format(OffsetDateTime.parse(promisedAt))
        }.getOrDefault("時間待定")
    }

    private fun loadLatestDriverLocation(token: String, driverId: String): Pair<Double, Double>? {
        loadDeviceLocation()?.let { return it }

        val locations = requestArray(
            path = "/rest/v1/driver_locations?select=latitude,longitude&driver_id=eq.${urlEncode(driverId)}&order=captured_at.desc&limit=1",
            token = token,
        )

        if (locations.length() == 0) return null
        val location = locations.getJSONObject(0)
        return location.optDouble("latitude", 0.0) to location.optDouble("longitude", 0.0)
    }

    private fun loadDeviceLocation(): Pair<Double, Double>? {
        val context = AppContextHolder.requireContext()
        val hasPermission =
            ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) ==
                android.content.pm.PackageManager.PERMISSION_GRANTED ||
                ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) ==
                android.content.pm.PackageManager.PERMISSION_GRANTED

        if (!hasPermission) return null

        val locationManager = context.getSystemService(android.content.Context.LOCATION_SERVICE) as? LocationManager
            ?: return null
        val providers = listOf(LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER, LocationManager.PASSIVE_PROVIDER)
        val best = providers.mapNotNull { provider ->
            runCatching { locationManager.getLastKnownLocation(provider) }.getOrNull()
        }.maxByOrNull { it.time } ?: return null

        return best.latitude to best.longitude
    }

    private fun loadAllDeliveredOrders(): List<Order> {
        val token = session?.accessToken ?: return emptyList()
        val driverId = currentDriver?.id ?: return emptyList()
        val latestDriverLocation = loadLatestDriverLocation(token, driverId)
        val deliveredEvents = requestArray(
            path = "/rest/v1/order_events?select=order_id,created_at&actor_driver_id=eq.${urlEncode(driverId)}&event_type=eq.delivered&order=created_at.desc",
            token = token,
        )
        if (deliveredEvents.length() == 0) return emptyList()

        val orderIds = buildList {
            for (index in 0 until deliveredEvents.length()) {
                add(deliveredEvents.getJSONObject(index).getString("order_id"))
            }
        }

        val ordersArray = requestArray(
            path = "/rest/v1/orders?select=id,external_order_id,status,assigned_fee_mop,promised_at,shop_id,customer_id&id=in.(${orderIds.joinToString(",") { "\"$it\"" }})",
            token = token,
        )

        return mapOrders(token, ordersArray, latestDriverLocation).sortedByDescending { it.deliveredAt ?: "" }
    }

    private fun loadActiveOrderById(token: String, orderId: String): Order? {
        val driverId = currentDriver?.id ?: return null
        val latestDriverLocation = loadLatestDriverLocation(token, driverId)
        val ordersArray = requestArray(
            path = "/rest/v1/orders?select=id,external_order_id,status,assigned_fee_mop,promised_at,shop_id,customer_id&id=eq.${urlEncode(orderId)}",
            token = token,
        )
        return mapOrders(token, ordersArray, latestDriverLocation).firstOrNull()
    }

    private fun proofPublicUrl(storagePath: String): String {
        return "${BuildConfig.SUPABASE_URL}/storage/v1/object/public/delivery-proofs/$storagePath"
    }

    private fun createSignedProofUrl(storagePath: String, token: String): String? {
        return runCatching {
            val response = requestJson(
                path = "/storage/v1/object/sign/delivery-proofs/${encodePathSegments(storagePath)}",
                method = "POST",
                token = token,
                body = JSONObject().put("expiresIn", 86400).toString(),
            )
            val signedUrl = response.optString("signedURL").ifBlank { response.optString("signedUrl") }
            when {
                signedUrl.isBlank() -> null
                signedUrl.startsWith("http") -> signedUrl
                else -> "${BuildConfig.SUPABASE_URL}$signedUrl"
            }
        }.getOrNull()
    }

    private fun encodePathSegments(path: String): String {
        return path.split("/").joinToString("/") { urlEncode(it) }
    }

    private fun historyRangeQuery(filter: HistoryRange, column: String): String {
        val today = LocalDate.now()
        val offset = OffsetDateTime.now().offset
        val start = when (filter) {
            HistoryRange.TODAY -> today.atStartOfDay()
            HistoryRange.YESTERDAY -> today.minusDays(1).atStartOfDay()
            HistoryRange.THIS_WEEK -> today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)).atStartOfDay()
            HistoryRange.THIS_MONTH -> today.withDayOfMonth(1).atStartOfDay()
            HistoryRange.ALL -> null
        } ?: return ""

        val end = when (filter) {
            HistoryRange.TODAY -> today.atTime(23, 59, 59)
            HistoryRange.YESTERDAY -> today.minusDays(1).atTime(23, 59, 59)
            HistoryRange.THIS_WEEK -> today.atTime(23, 59, 59)
            HistoryRange.THIS_MONTH -> today.atTime(23, 59, 59)
            HistoryRange.ALL -> null
        } ?: return ""

        val startValue = urlEncode(start.atOffset(offset).format(DateTimeFormatter.ISO_OFFSET_DATE_TIME))
        val endValue = urlEncode(end.atOffset(offset).format(DateTimeFormatter.ISO_OFFSET_DATE_TIME))
        return "&$column=gte.$startValue&$column=lte.$endValue"
    }

    private fun mapOrders(
        token: String,
        ordersArray: JSONArray,
        latestDriverLocation: Pair<Double, Double>?,
    ): List<Order> {
        if (ordersArray.length() == 0) {
            return emptyList()
        }

        val shopIds = mutableSetOf<String>()
        val customerIds = mutableSetOf<String>()
        for (index in 0 until ordersArray.length()) {
            val json = ordersArray.getJSONObject(index)
            shopIds.add(json.getString("shop_id"))
            customerIds.add(json.getString("customer_id"))
        }

        val shopsArray = if (shopIds.isNotEmpty()) {
            requestArray(
                path = "/rest/v1/shops?select=id,name,address,latitude,longitude,contact_name,contact_phone&id=in.(${shopIds.joinToString(",") { "\"$it\"" }})",
                token = token,
            )
        } else JSONArray()

        val customersArray = if (customerIds.isNotEmpty()) {
            requestArray(
                path = "/rest/v1/customers?select=id,name,address,latitude,longitude,phone,delivery_note&id=in.(${customerIds.joinToString(",") { "\"$it\"" }})",
                token = token,
            )
        } else JSONArray()

        val orderIds = buildList {
            for (index in 0 until ordersArray.length()) {
                add(ordersArray.getJSONObject(index).getString("id"))
            }
        }
        val itemsArray = requestArray(
            path = "/rest/v1/order_items?select=order_id,item_name,quantity&order_id=in.(${orderIds.joinToString(",") { "\"$it\"" }})",
            token = token,
        )
        val eventsArray = requestArray(
            path = "/rest/v1/order_events?select=order_id,event_type,created_at,payload&order_id=in.(${orderIds.joinToString(",") { "\"$it\"" }})&order=created_at.asc",
            token = token,
        )
        val proofsArray = requestArray(
            path = "/rest/v1/delivery_proofs?select=order_id,storage_path,created_at&order_id=in.(${orderIds.joinToString(",") { "\"$it\"" }})&order=created_at.desc",
            token = token,
        )

        val shops = jsonArrayToMap(shopsArray) { it.getString("id") }
        val customers = jsonArrayToMap(customersArray) { it.getString("id") }
        val itemsByOrder = mutableMapOf<String, MutableList<OrderItem>>()
        val pickedUpAtByOrder = mutableMapOf<String, String>()
        val deliveredAtByOrder = mutableMapOf<String, String>()
        val proofPathByOrder = mutableMapOf<String, String>()
        val cancelReasonByOrder = mutableMapOf<String, String>()
        val cancelOtherReasonByOrder = mutableMapOf<String, String>()
        val cancelHandlingByOrder = mutableMapOf<String, CancelHandling>()
        for (index in 0 until itemsArray.length()) {
            val item = itemsArray.getJSONObject(index)
            val list = itemsByOrder.getOrPut(item.getString("order_id")) { mutableListOf() }
            list.add(OrderItem(name = item.getString("item_name"), quantity = item.getInt("quantity")))
        }
        for (index in 0 until eventsArray.length()) {
            val event = eventsArray.getJSONObject(index)
            val orderId = event.getString("order_id")
            val eventType = event.optString("event_type")
            if (
                orderId !in pickedUpAtByOrder &&
                (eventType == "picked_up" || eventType == "arrived_customer")
            ) {
                pickedUpAtByOrder[orderId] = event.optString("created_at")
            }
            if (orderId !in deliveredAtByOrder && eventType == "delivered") {
                deliveredAtByOrder[orderId] = event.optString("created_at")
            }
            val payload = event.optJSONObject("payload")
            if (payload != null && payload.has("cancel_reason")) {
                cancelReasonByOrder[orderId] = payload.optString("cancel_reason")
                cancelOtherReasonByOrder[orderId] = payload.optString("cancel_other_reason")
                cancelHandlingByOrder[orderId] = when (payload.optString("cancel_handling")) {
                    "return_to_shop" -> CancelHandling.RETURN_TO_SHOP
                    "not_returning" -> CancelHandling.NOT_RETURNING
                    else -> CancelHandling.NOT_RETURNING
                }
            }
        }
        for (index in 0 until proofsArray.length()) {
            val proof = proofsArray.getJSONObject(index)
            val orderId = proof.getString("order_id")
            if (orderId !in proofPathByOrder) {
                proofPathByOrder[orderId] = proof.optString("storage_path")
            }
        }

        return buildList {
            for (index in 0 until ordersArray.length()) {
                val json = ordersArray.getJSONObject(index)
                val shop = shops[json.getString("shop_id")] ?: continue
                val customer = customers[json.getString("customer_id")] ?: continue
                val mappedStatus = json.optString("status").toOrderStatus()
                val shopLat = shop.optDouble("latitude", 0.0)
                val shopLng = shop.optDouble("longitude", 0.0)
                val distanceToShop = latestDriverLocation?.let { (driverLat, driverLng) ->
                    haversineKm(driverLat, driverLng, shopLat, shopLng)
                } ?: 0.0
                val customerLat = customer.optDouble("latitude", 0.0)
                val customerLng = customer.optDouble("longitude", 0.0)
                val distanceToCustomer = latestDriverLocation?.let { (driverLat, driverLng) ->
                    haversineKm(driverLat, driverLng, customerLat, customerLng)
                } ?: 0.0
                val activeDistance = when (mappedStatus) {
                    OrderStatus.PICKED_UP,
                    OrderStatus.HEADING_TO_CUSTOMER -> distanceToCustomer
                    OrderStatus.DELIVERED -> 0.0
                    else -> distanceToShop
                }

                add(
                    Order(
                        id = json.getString("id"),
                        externalOrderId = json.optString("external_order_id", json.getString("id")),
                        status = mappedStatus,
                        shop = LocationPoint(
                            label = shop.optString("name", "店舖"),
                            address = shop.optString("address", ""),
                            latitude = shopLat,
                            longitude = shopLng,
                            contactName = shop.optString("contact_name", "店舖"),
                            contactPhone = shop.optString("contact_phone", ""),
                        ),
                        customer = LocationPoint(
                            label = customer.optString("name", "客戶"),
                            address = customer.optString("address", ""),
                            latitude = customer.optDouble("latitude", 0.0),
                            longitude = customer.optDouble("longitude", 0.0),
                            contactName = customer.optString("name", "客戶"),
                            contactPhone = customer.optString("phone", ""),
                        ),
                        customerNote = customer.optString("delivery_note", "請先聯絡客戶。"),
                        etaMinutes = calculateEtaMinutes(json.optString("promised_at", "")),
                        deliveryDeadlineText = formatDeadline(json.optString("promised_at", "")),
                        promisedAt = json.optString("promised_at").ifBlank { null },
                        distanceKm = activeDistance,
                        totalAmountMop = json.optDouble("assigned_fee_mop", 0.0),
                        items = itemsByOrder[json.getString("id")] ?: emptyList(),
                        pickedUpAt = pickedUpAtByOrder[json.getString("id")],
                        deliveredAt = deliveredAtByOrder[json.getString("id")],
                        proofOfDeliveryPath = proofPathByOrder[json.getString("id")],
                        proofOfDeliveryUrl = proofPathByOrder[json.getString("id")]?.let { createSignedProofUrl(it, token) ?: proofPublicUrl(it) },
                        cancelReason = cancelReasonByOrder[json.getString("id")],
                        cancelOtherReason = cancelOtherReasonByOrder[json.getString("id")],
                        cancelHandling = cancelHandlingByOrder[json.getString("id")],
                    ),
                )
            }
        }
    }

    private fun haversineKm(
        startLat: Double,
        startLng: Double,
        endLat: Double,
        endLng: Double,
    ): Double {
        if (startLat == 0.0 || startLng == 0.0 || endLat == 0.0 || endLng == 0.0) return 0.0

        val earthRadiusKm = 6371.0
        val dLat = Math.toRadians(endLat - startLat)
        val dLng = Math.toRadians(endLng - startLng)
        val a = sin(dLat / 2).pow(2) +
            cos(Math.toRadians(startLat)) * cos(Math.toRadians(endLat)) * sin(dLng / 2).pow(2)
        val c = 2 * asin(sqrt(a))
        return kotlin.math.round(earthRadiusKm * c * 10) / 10.0
    }

    private fun String.toOrderStatus(): OrderStatus {
        return when (this) {
            "accepted" -> OrderStatus.HEADING_TO_SHOP
            "assigned" -> OrderStatus.ASSIGNED
            "arrived_shop" -> OrderStatus.HEADING_TO_SHOP
            "picked_up" -> OrderStatus.PICKED_UP
            "arrived_customer" -> OrderStatus.HEADING_TO_CUSTOMER
            "delivered" -> OrderStatus.DELIVERED
            "canceled" -> OrderStatus.CANCELED
            else -> OrderStatus.ASSIGNED
        }
    }

    private fun DriverAvailability.toApiValue(): String {
        return if (this == DriverAvailability.ONLINE) "online" else "offline"
    }

    private fun JSONObject.toDriverProfile(): DriverProfile {
        val approval = when (optString("approval_status")) {
            "approved" -> ApprovalStatus.APPROVED
            "rejected" -> ApprovalStatus.REJECTED
            else -> ApprovalStatus.PENDING_APPROVAL
        }
        val availability = if (optString("availability") == "online") {
            DriverAvailability.ONLINE
        } else {
            DriverAvailability.OFFLINE
        }
        return DriverProfile(
            id = getString("id"),
            fullName = optString("full_name", "騎手"),
            phone = optString("phone", ""),
            approvalStatus = approval,
            availability = availability,
        )
    }

    private fun uploadToStorage(
        bucket: String,
        objectPath: String,
        uri: Uri,
        accessToken: String,
    ): String {
        val context = AppContextHolder.requireContext()
        val contentResolver = context.contentResolver
        val mimeType = contentResolver.getType(uri) ?: "image/jpeg"
        val inputStream = when (uri.scheme) {
            "content" -> requireNotNull(contentResolver.openInputStream(uri)) { "無法讀取檔案。" }
            "file", null -> {
                val filePath = requireNotNull(uri.path) { "無法讀取檔案。" }
                java.io.File(filePath).inputStream()
            }
            else -> requireNotNull(contentResolver.openInputStream(uri)) { "無法讀取檔案。" }
        }
        val rawBytes = inputStream.use { it.readBytes() }
        val (bytes, uploadMimeType) = compressImageIfNeeded(rawBytes, mimeType)

        val request = Request.Builder()
            .url("${BuildConfig.SUPABASE_URL}/storage/v1/object/$bucket/$objectPath")
            .addHeader("apikey", BuildConfig.SUPABASE_ANON_KEY)
            .addHeader("Authorization", "Bearer $accessToken")
            .addHeader("x-upsert", "true")
            .post(bytes.toRequestBody(uploadMimeType.toMediaType()))
            .build()

        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) {
                throw IllegalStateException(extractErrorMessage(response.body?.string().orEmpty()))
            }
        }
        return objectPath
    }

    private fun compressImageIfNeeded(bytes: ByteArray, mimeType: String): Pair<ByteArray, String> {
        if (!mimeType.startsWith("image/")) return bytes to mimeType

        val originalBitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size) ?: return bytes to mimeType
        val maxDimension = 1600
        val scale = minOf(
            1.0,
            maxDimension.toDouble() / originalBitmap.width.toDouble(),
            maxDimension.toDouble() / originalBitmap.height.toDouble(),
        )
        val targetWidth = (originalBitmap.width * scale).toInt().coerceAtLeast(1)
        val targetHeight = (originalBitmap.height * scale).toInt().coerceAtLeast(1)
        val scaledBitmap =
            if (targetWidth != originalBitmap.width || targetHeight != originalBitmap.height) {
                android.graphics.Bitmap.createScaledBitmap(originalBitmap, targetWidth, targetHeight, true)
            } else {
                originalBitmap
            }

        val output = ByteArrayOutputStream()
        scaledBitmap.compress(android.graphics.Bitmap.CompressFormat.JPEG, 72, output)
        if (scaledBitmap !== originalBitmap) scaledBitmap.recycle()
        originalBitmap.recycle()
        return output.toByteArray() to "image/jpeg"
    }

    private fun requestJson(
        path: String,
        method: String = "GET",
        token: String,
        body: String? = null,
        prefer: String? = null,
    ): JSONObject {
        return JSONObject(requestRaw(path, method, token, body, prefer))
    }

    private fun requestArray(
        path: String,
        method: String = "GET",
        token: String,
        body: String? = null,
        prefer: String? = null,
    ): JSONArray {
        val raw = requestRaw(path, method, token, body, prefer)
        return if (raw.isBlank()) JSONArray() else JSONArray(raw)
    }

    private fun requestRaw(
        path: String,
        method: String,
        token: String,
        body: String? = null,
        prefer: String? = null,
    ): String {
        val builder = Request.Builder()
            .url("${BuildConfig.SUPABASE_URL}$path")
            .addHeader("apikey", BuildConfig.SUPABASE_ANON_KEY)
            .addHeader("Authorization", "Bearer $token")
            .addHeader("Content-Type", "application/json")

        if (!prefer.isNullOrBlank()) {
            builder.addHeader("Prefer", prefer)
        }

        when (method) {
            "POST" -> builder.post((body ?: "{}").toRequestBody("application/json".toMediaType()))
            "PATCH" -> builder.patch((body ?: "{}").toRequestBody("application/json".toMediaType()))
            else -> builder.get()
        }

        client.newCall(builder.build()).execute().use { response ->
            val raw = response.body?.string().orEmpty()
            if (!response.isSuccessful) {
                throw IllegalStateException(extractErrorMessage(raw))
            }
            return raw
        }
    }

    private fun extractErrorMessage(raw: String): String {
        return runCatching {
            val json = JSONObject(raw)
            json.optString("message")
                .ifBlank { json.optString("error_description") }
                .ifBlank { json.optString("error") }
                .ifBlank { raw }
        }.getOrDefault(raw.ifBlank { "發生未知錯誤。" })
    }

    private fun urlEncode(value: String): String = java.net.URLEncoder.encode(value, "UTF-8")
}
