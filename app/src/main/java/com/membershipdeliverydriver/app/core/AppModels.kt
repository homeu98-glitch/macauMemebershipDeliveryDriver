package com.membershipdeliverydriver.app.core

import android.net.Uri
import java.time.LocalDateTime

enum class DriverAvailability { ONLINE, OFFLINE }

enum class OrderStatus {
    NEW,
    NEW_URGENT,
    ASSIGNED,
    HEADING_TO_SHOP,
    PICKED_UP,
    HEADING_TO_CUSTOMER,
    DELIVERED,
    CANCELED,
    CANCELED_BY_DRIVER,
    CANCELED_BY_SHOP_OWNER,
    ISSUE_REPORTED,
}

fun OrderStatus.isCanceledLike(): Boolean =
    this == OrderStatus.CANCELED || this == OrderStatus.CANCELED_BY_DRIVER || this == OrderStatus.CANCELED_BY_SHOP_OWNER

fun OrderStatus.isDriverCanceled(): Boolean = this == OrderStatus.CANCELED_BY_DRIVER
fun OrderStatus.isShopOwnerCanceled(): Boolean = this == OrderStatus.CANCELED_BY_SHOP_OWNER
fun OrderStatus.isUrgentNew(): Boolean = this == OrderStatus.NEW_URGENT
fun OrderStatus.isNewLike(): Boolean = this == OrderStatus.NEW || this == OrderStatus.NEW_URGENT

enum class CancelHandling {
    RETURN_TO_SHOP,
    NOT_RETURNING,
}

enum class HistoryRange {
    TODAY,
    YESTERDAY,
    THIS_WEEK,
    THIS_MONTH,
    ALL,
}

data class DriverProfile(
    val id: String,
    val fullName: String,
    val phone: String,
    val approvalStatus: ApprovalStatus,
    val availability: DriverAvailability,
)

enum class ApprovalStatus { PENDING_APPROVAL, APPROVED, REJECTED }

data class RegistrationDocument(
    val label: String,
    val uri: Uri? = null,
)

data class RegistrationForm(
    val fullName: String = "",
    val phone: String = "",
    val password: String = "",
    val selfie: RegistrationDocument = RegistrationDocument(label = "自拍照"),
    val macauId: RegistrationDocument = RegistrationDocument(label = "澳門身份證"),
    val drivingLicence: RegistrationDocument = RegistrationDocument(label = "駕駛執照"),
)

data class LoginForm(
    val phone: String = "",
    val password: String = "",
)

data class LocationPoint(
    val label: String,
    val address: String,
    val district: String? = null,
    val latitude: Double,
    val longitude: Double,
    val contactName: String,
    val contactPhone: String,
    val totalSentOrders: Int = 0,
)

data class OrderItem(
    val name: String,
    val quantity: Int,
)

data class Order(
    val id: String,
    val externalOrderId: String,
    val transactionCode: String? = null,
    val status: OrderStatus,
    val isUrgent: Boolean = false,
    val shop: LocationPoint,
    val customer: LocationPoint,
    val customerNote: String,
    val etaMinutes: Int,
    val deliveryDeadlineText: String,
    val promisedAt: String? = null,
    val publishedAt: String? = null,
    val distanceKm: Double,
    val totalAmountMop: Double,
    val items: List<OrderItem>,
    val acceptedAt: String? = null,
    val paymentTag: String = "客人支付運費",
    val pickedUpAt: String? = null,
    val deliveredAt: String? = null,
    val proofOfDeliveryUri: Uri? = null,
    val proofOfDeliveryPath: String? = null,
    val proofOfDeliveryUrl: String? = null,
    val cancelReason: String? = null,
    val cancelOtherReason: String? = null,
    val cancelHandling: CancelHandling? = null,
    val issueNote: String = "",
)

data class EarningEntry(
    val id: String,
    val title: String,
    val amountMop: Double,
    val completedAt: LocalDateTime,
)

data class DriverAnnouncement(
    val id: String,
    val title: String,
    val content: String,
    val createdAt: String,
)

data class AppUpdateInfo(
    val version: String,
    val releaseNotes: String,
    val downloadPageUrl: String,
)

data class DriverDashboard(
    val todayEarningsMop: Double,
    val weekEarningsMop: Double,
    val completedToday: Int,
    val pendingApprovalHint: String,
)

data class CallbackEnvelope(
    val type: String,
    val success: Boolean,
    val message: String,
    val jwt: String? = null,
)

data class DriverAppState(
    val loginForm: LoginForm = LoginForm(),
    val registrationForm: RegistrationForm = RegistrationForm(),
    val currentDriver: DriverProfile? = null,
    val dashboard: DriverDashboard = DriverDashboard(
        todayEarningsMop = 0.0,
        weekEarningsMop = 0.0,
        completedToday = 0,
        pendingApprovalHint = "自拍照、澳門身份證與駕駛執照會由後台審核。",
    ),
    val availableOrders: List<Order> = emptyList(),
    val orders: List<Order> = emptyList(),
    val completedOrders: List<Order> = emptyList(),
    val earnings: List<EarningEntry> = emptyList(),
    val activeOrderId: String? = null,
    val acceptingOrderId: String? = null,
    val completedOrdersFilter: HistoryRange = HistoryRange.TODAY,
    val completedOrdersPage: Int = 0,
    val completedOrdersHasMore: Boolean = true,
    val pickupDistrictFilter: Set<String> = emptySet(),
    val destinationDistrictFilter: Set<String> = emptySet(),
    val announcements: List<DriverAnnouncement> = emptyList(),
    val updateInfo: AppUpdateInfo? = null,
    val registrationSubmitted: Boolean = false,
    val lastCallback: CallbackEnvelope? = null,
    val isLoading: Boolean = false,
    val isRefreshing: Boolean = false,
    val isLoadingCompletedOrders: Boolean = false,
    val proofViewerOrderId: String? = null,
    val proofViewerBytes: ByteArray? = null,
    val proofViewerLoading: Boolean = false,
    val earningsFilter: HistoryRange = HistoryRange.TODAY,
    val errorMessage: String? = null,
)

data class PagedOrdersResult(
    val items: List<Order>,
    val page: Int,
    val hasMore: Boolean,
)
