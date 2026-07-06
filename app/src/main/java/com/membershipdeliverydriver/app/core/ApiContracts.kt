package com.membershipdeliverydriver.app.core

sealed interface ApiResult<out T> {
    data class Success<T>(val value: T, val warning: String? = null) : ApiResult<T>
    data class Failure(val message: String, val cause: Throwable? = null) : ApiResult<Nothing>
}

data class AuthSession(
    val accessToken: String,
    val refreshToken: String,
    val expiresInSeconds: Long,
)

data class LoginPayload(
    val phone: String,
    val password: String,
)

data class RegistrationPayload(
    val fullName: String,
    val phone: String,
    val password: String,
    val selfieUri: String,
    val macauIdUri: String,
    val drivingLicenceUri: String,
)

data class OrderStatusPatch(
    val orderId: String,
    val status: OrderStatus,
    val proofOfDeliveryUri: String? = null,
    val issueNote: String? = null,
)

fun interface AuthCallback {
    fun onAuthResult(callback: CallbackEnvelope)
}

fun interface RegistrationCallback {
    fun onRegistrationSubmitted(callback: CallbackEnvelope)
}

fun interface OrdersSyncCallback {
    fun onOrdersSynced(callback: CallbackEnvelope)
}

interface AuthGateway {
    suspend fun login(payload: LoginPayload, callback: AuthCallback? = null): ApiResult<AuthSession>
    suspend fun submitRegistration(
        payload: RegistrationPayload,
        callback: RegistrationCallback? = null,
    ): ApiResult<ApprovalStatus>
}

interface OrdersGateway {
    suspend fun syncOrders(jwt: String, callback: OrdersSyncCallback? = null): ApiResult<List<Order>>
    suspend fun patchOrder(jwt: String, patch: OrderStatusPatch): ApiResult<Order>
}
