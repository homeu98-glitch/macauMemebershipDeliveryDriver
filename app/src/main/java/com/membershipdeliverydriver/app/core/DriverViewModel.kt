package com.membershipdeliverydriver.app.core

import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

class DriverViewModel(
    private val repository: DriverRepository = SupabaseDriverRepository(),
) : ViewModel() {

    private val _uiState = MutableStateFlow(DriverAppState())
    val uiState: StateFlow<DriverAppState> = _uiState.asStateFlow()

    init {
        refreshDashboard()
    }

    fun updateLoginPhone(value: String) {
        _uiState.update { it.copy(loginForm = it.loginForm.copy(phone = value), errorMessage = null) }
    }

    fun updateLoginPassword(value: String) {
        _uiState.update { it.copy(loginForm = it.loginForm.copy(password = value), errorMessage = null) }
    }

    fun updateRegistrationName(value: String) {
        _uiState.update {
            it.copy(registrationForm = it.registrationForm.copy(fullName = value), errorMessage = null)
        }
    }

    fun updateRegistrationPhone(value: String) {
        _uiState.update {
            it.copy(registrationForm = it.registrationForm.copy(phone = value), errorMessage = null)
        }
    }

    fun updateRegistrationPassword(value: String) {
        _uiState.update {
            it.copy(registrationForm = it.registrationForm.copy(password = value), errorMessage = null)
        }
    }

    fun updateRegistrationDocument(type: DocumentType, uri: Uri) {
        _uiState.update { current ->
            val form = current.registrationForm
            val updatedForm = when (type) {
                DocumentType.SELFIE -> form.copy(selfie = form.selfie.copy(uri = uri))
                DocumentType.MACAU_ID -> form.copy(macauId = form.macauId.copy(uri = uri))
                DocumentType.DRIVING_LICENCE -> form.copy(drivingLicence = form.drivingLicence.copy(uri = uri))
            }
            current.copy(registrationForm = updatedForm, errorMessage = null)
        }
    }

    fun login() {
        val form = _uiState.value.loginForm
        if (!isValidPin(form.password)) {
            _uiState.update { it.copy(errorMessage = "請輸入 4 位數字密碼。") }
            return
        }

        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            when (val result = repository.login(form)) {
                is ApiResult.Success -> {
                    if (result.value.availability == DriverAvailability.ONLINE) {
                        DriverNotifications.startDispatchService(
                            AppContextHolder.requireContext(),
                            result.value.fullName
                        )
                    } else {
                        DriverNotifications.stopDispatchService(AppContextHolder.requireContext())
                    }
                    _uiState.update { state ->
                        state.copy(
                            currentDriver = result.value,
                            isLoading = false,
                            errorMessage = null,
                        )
                    }
                    refreshDashboard()
                }
                is ApiResult.Failure -> {
                    _uiState.update { it.copy(isLoading = false, errorMessage = result.message) }
                }
            }
        }
    }

    fun submitRegistration(onSuccess: () -> Unit) {
        val form = _uiState.value.registrationForm
        if (
            form.fullName.isBlank() ||
            form.phone.isBlank() ||
            form.password.isBlank() ||
            form.selfie.uri == null ||
            form.macauId.uri == null ||
            form.drivingLicence.uri == null
        ) {
            _uiState.update {
                it.copy(errorMessage = "請先填妥所有欄位並上傳所需文件。")
            }
            return
        }

        if (!isValidPin(form.password)) {
            _uiState.update { it.copy(errorMessage = "請使用 4 位數字作為登入密碼。") }
            return
        }

        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            when (val result = repository.submitRegistration(form)) {
                is ApiResult.Success -> {
                    _uiState.update { state ->
                        state.copy(
                            isLoading = false,
                            registrationSubmitted = true,
                            lastCallback = CallbackEnvelope(
                                type = "driver.registration",
                                success = true,
                                message = "申請已提交，等待後台審核。",
                            ),
                        )
                    }
                    onSuccess()
                }
                is ApiResult.Failure -> {
                    _uiState.update { it.copy(isLoading = false, errorMessage = result.message) }
                }
            }
        }
    }

    fun toggleAvailability() {
        val currentDriver = _uiState.value.currentDriver ?: return
        viewModelScope.launch {
            try {
                val updatedAvailability = repository.toggleAvailability(currentDriver.availability)
                if (updatedAvailability == DriverAvailability.ONLINE) {
                    DriverNotifications.startDispatchService(
                        AppContextHolder.requireContext(),
                        currentDriver.fullName
                    )
                } else {
                    DriverNotifications.stopDispatchService(AppContextHolder.requireContext())
                }
                _uiState.update {
                    it.copy(currentDriver = currentDriver.copy(availability = updatedAvailability))
                }
            } catch (error: Exception) {
                _uiState.update {
                    it.copy(
                        errorMessage = error.message ?: "無法切換接單狀態，請稍後再試。"
                    )
                }
            }
        }
    }

    fun selectOrder(orderId: String) {
        _uiState.update { it.copy(activeOrderId = orderId) }
    }

    fun clearError() {
        _uiState.update { it.copy(errorMessage = null) }
    }

    fun logout() {
        viewModelScope.launch {
            DriverNotifications.stopDispatchService(AppContextHolder.requireContext())
            repository.logout()
            _uiState.value = DriverAppState()
        }
    }

    fun acceptOrder(orderId: String) {
        viewModelScope.launch {
            when (val result = repository.acceptOrder(orderId)) {
                is ApiResult.Success -> {
                    _uiState.update {
                        it.copy(
                            availableOrders = it.availableOrders.filterNot { order -> order.id == orderId },
                            orders = (it.orders.filterNot { order -> order.id == orderId } + result.value)
                                .sortedBy { order -> order.etaMinutes },
                        )
                    }
                }
                is ApiResult.Failure -> _uiState.update { it.copy(errorMessage = result.message) }
            }
        }
    }

    fun uploadProofOfDelivery(orderId: String, uri: Uri) {
        viewModelScope.launch {
            when (val result = repository.attachProofOfDelivery(orderId, uri)) {
                is ApiResult.Success -> {
                    DriverSoundEffects.playOrderCompleted(AppContextHolder.requireContext())
                    _uiState.update { it.copy(orders = it.orders.replaceOrder(result.value)) }
                }
                is ApiResult.Failure -> _uiState.update { it.copy(errorMessage = result.message) }
            }
        }
    }

    fun markOrderPickedUp(orderId: String) {
        viewModelScope.launch {
            when (val result = repository.markOrderPickedUp(orderId)) {
                is ApiResult.Success -> {
                    _uiState.update { it.copy(orders = it.orders.replaceOrder(result.value)) }
                }
                is ApiResult.Failure -> _uiState.update { it.copy(errorMessage = result.message) }
            }
        }
    }

    fun reportIssue(orderId: String, note: String) {
        if (note.isBlank()) {
            _uiState.update { it.copy(errorMessage = "請先輸入異常說明。") }
            return
        }
        viewModelScope.launch {
            when (val result = repository.reportIssue(orderId, note)) {
                is ApiResult.Success -> {
                    _uiState.update { it.copy(orders = it.orders.replaceOrder(result.value)) }
                }
                is ApiResult.Failure -> _uiState.update { it.copy(errorMessage = result.message) }
            }
        }
    }

    fun refreshDashboard() {
        if (_uiState.value.currentDriver == null) return
        viewModelScope.launch {
            val previousOrders = _uiState.value.availableOrders
            _uiState.update { it.copy(isRefreshing = true) }
            try {
                val availableOrders = repository.loadAvailableOrders()
                val orders = repository.loadOrders()
                val earnings = repository.loadEarnings()
                val deliveredToday = orders.count { it.status == OrderStatus.DELIVERED }
                val todayEarnings = earnings
                    .filter { it.completedAt.toLocalDate() == java.time.LocalDate.now() }
                    .sumOf { it.amountMop }
                val weekEarnings = earnings.sumOf { it.amountMop }

                _uiState.update { current ->
                    current.copy(
                        availableOrders = availableOrders,
                        orders = orders,
                        earnings = earnings,
                        dashboard = current.dashboard.copy(
                            todayEarningsMop = todayEarnings,
                            weekEarningsMop = weekEarnings,
                            completedToday = deliveredToday,
                        ),
                        activeOrderId = current.activeOrderId ?: orders.firstOrNull()?.id,
                        isRefreshing = false,
                    )
                }

                val previousIds = previousOrders.map { it.id }.toSet()
                val newOrders = availableOrders.filterNot { previousIds.contains(it.id) }
                if (newOrders.isNotEmpty()) {
                    DriverNotifications.notifyNewOrders(
                        context = AppContextHolder.requireContext(),
                        count = newOrders.size,
                        firstShopName = newOrders.firstOrNull()?.shop?.label
                    )
                }
            } catch (error: Exception) {
                _uiState.update {
                    it.copy(
                        availableOrders = emptyList(),
                        orders = emptyList(),
                        earnings = emptyList(),
                        isRefreshing = false,
                        errorMessage = error.message ?: "目前無法同步訂單資料，請稍後再試。",
                    )
                }
            }
        }
    }

    enum class DocumentType {
        SELFIE,
        MACAU_ID,
        DRIVING_LICENCE,
    }
}

private fun List<Order>.replaceOrder(order: Order): List<Order> {
    return map { current -> if (current.id == order.id) order else current }
}

private fun isValidPin(value: String): Boolean {
    return value.length == 4 && value.all { it.isDigit() }
}
