package com.membershipdeliverydriver.app.core

import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.OffsetDateTime

private fun isNewerVersion(current: String, latest: String): Boolean {
    fun parse(v: String) = v.split(".").map { it.toIntOrNull() ?: 0 }
    val a = parse(current)
    val b = parse(latest)
    val n = maxOf(a.size, b.size)
    for (i in 0 until n) {
        val ai = a.getOrElse(i) { 0 }
        val bi = b.getOrElse(i) { 0 }
        if (bi != ai) return bi > ai
    }
    return false
}

class DriverViewModel(
    private val repository: DriverRepository = SupabaseDriverRepository(),
) : ViewModel() {
    private val overdueAlertedOrderIds = mutableSetOf<String>()

    private val _uiState = MutableStateFlow(DriverAppState())
    val uiState: StateFlow<DriverAppState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            // Check OTA update info early (no login required)
            runCatching {
                val latest = repository.fetchLatestAppRelease()
                if (latest != null && isNewerVersion(com.membershipdeliverydriver.app.BuildConfig.VERSION_NAME, latest.version)) {
                    _uiState.update { it.copy(updateInfo = latest) }
                }
            }

            when (val restored = repository.restoreSession()) {
                is ApiResult.Success -> {
                    if (restored.value.availability == DriverAvailability.ONLINE) {
                        DriverNotifications.startDispatchService(
                            AppContextHolder.requireContext(),
                            restored.value.id,
                            restored.value.fullName
                        )
                    }
                    _uiState.update { it.copy(currentDriver = restored.value) }
                    restored.warning?.let { warning ->
                        _uiState.update { it.copy(errorMessage = warning) }
                    }
                    refreshDashboard()
                    // Load announcements
                    runCatching {
                        val ann = repository.loadAnnouncements()
                        _uiState.update { it.copy(announcements = ann) }
                    }
                }
                is ApiResult.Failure -> {
                    _uiState.update { it.copy(errorMessage = restored.message) }
                }
                null -> Unit
            }
        }
    }

    fun onPushOrderUpdate() {
        refreshDashboard(playArrivalSound = false)
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
                            result.value.id,
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
                    result.warning?.let { warning ->
                        _uiState.update { it.copy(errorMessage = warning) }
                    }
                    refreshDashboard()
                    // Load announcements
                    runCatching {
                        val ann = repository.loadAnnouncements()
                        _uiState.update { it.copy(announcements = ann) }
                    }
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
                        currentDriver.id,
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

    fun dismissUpdateInfo() {
        _uiState.update { it.copy(updateInfo = null) }
    }

    fun selectPickupDistrictFilter(value: String?) {
        _uiState.update { it.copy(pickupDistrictFilter = value) }
    }

    fun selectDestinationDistrictFilter(value: String?) {
        _uiState.update { it.copy(destinationDistrictFilter = value) }
    }


    fun refreshAnnouncements(showMessage: Boolean = false) {
        viewModelScope.launch {
            runCatching { repository.loadAnnouncements() }
                .onSuccess { ann ->
                    _uiState.update { it.copy(announcements = ann) }
                    if (showMessage) {
                        _uiState.update {
                            it.copy(errorMessage = if (ann.isEmpty()) "目前沒有新公告。" else "公告已更新。") }
                    }
                }
                .onFailure { error ->
                    if (showMessage) {
                        _uiState.update { it.copy(errorMessage = error.message ?: "刷新公告失敗。") }
                    }
                }
        }
    }

    fun checkForUpdates(manual: Boolean = false) {
        viewModelScope.launch {
            runCatching { repository.fetchLatestAppRelease() }
                .onSuccess { latest ->
                    when {
                        latest != null && isNewerVersion(com.membershipdeliverydriver.app.BuildConfig.VERSION_NAME, latest.version) -> {
                            _uiState.update { it.copy(updateInfo = latest) }
                        }
                        manual -> {
                            _uiState.update { it.copy(errorMessage = "已是最新版本。") }
                        }
                    }
                }
                .onFailure { error ->
                    if (manual) {
                        _uiState.update { it.copy(errorMessage = error.message ?: "檢查更新失敗。") }
                    }
                }
        }
    }

    fun logout() {
        viewModelScope.launch {
            DriverNotifications.stopDispatchService(AppContextHolder.requireContext())
            repository.logout()
            _uiState.value = DriverAppState()
        }
    }

    fun acceptOrder(orderId: String) {
        if (_uiState.value.acceptingOrderId != null) return
        _uiState.update { it.copy(acceptingOrderId = orderId, errorMessage = null) }
        viewModelScope.launch {
            when (val result = repository.acceptOrder(orderId)) {
                is ApiResult.Success -> {
                    _uiState.update {
                        it.copy(
                            acceptingOrderId = null,
                            availableOrders = it.availableOrders.filterNot { order -> order.id == orderId },
                            orders = (it.orders.filterNot { order -> order.id == orderId } + result.value)
                                .sortedBy { order -> order.etaMinutes },
                        )
                    }
                    result.warning?.let { warning ->
                        _uiState.update { it.copy(errorMessage = warning) }
                    }
                }
                is ApiResult.Failure -> {
                    _uiState.update { it.copy(acceptingOrderId = null, errorMessage = result.message) }
                }
            }
        }
    }

    fun uploadProofOfDelivery(orderId: String, uri: Uri) {
        val currentOrder = _uiState.value.orders.firstOrNull { it.id == orderId }
        if (currentOrder == null) {
            _uiState.update { it.copy(errorMessage = "找不到要完成的訂單。") }
            return
        }

        val optimisticOrder = currentOrder.copy(
            status = OrderStatus.DELIVERED,
            deliveredAt = java.time.OffsetDateTime.now().toString(),
            proofOfDeliveryUri = uri,
        )

        _uiState.update {
            it.copy(
                orders = it.orders.filterNot { order -> order.id == orderId },
                completedOrders = listOf(optimisticOrder) + it.completedOrders.filterNot { order -> order.id == orderId },
                activeOrderId = it.orders.firstOrNull { order -> order.id != orderId }?.id,
                errorMessage = "訂單已完成，送達照片正在背景上傳。",
            )
        }

        viewModelScope.launch {
            when (val result = repository.attachProofOfDelivery(orderId, uri)) {
                is ApiResult.Success -> {
                    DriverSoundEffects.playOrderCompleted(AppContextHolder.requireContext())
                    result.warning?.let { warning ->
                        _uiState.update { it.copy(errorMessage = warning) }
                    }
                    refreshDashboard()
                    refreshCompletedOrders(reset = true)
                }
                is ApiResult.Failure -> _uiState.update {
                    it.copy(errorMessage = "訂單已完成，但照片背景上傳失敗：${result.message}")
                }
            }
        }
    }

    fun cancelOrder(
        orderId: String,
        reason: String,
        otherReason: String?,
        handling: CancelHandling,
    ) {
        viewModelScope.launch {
            when (val result = repository.cancelOrder(orderId, reason, otherReason, handling)) {
                is ApiResult.Success -> {
                    _uiState.update {
                        it.copy(
                            orders = it.orders.replaceOrder(result.value),
                            errorMessage = when {
                                result.value.status.isDriverCanceled() -> "已提交取消，等待商戶確認。"
                                result.value.status.isShopOwnerCanceled() -> "訂單已被商戶取消。"
                                else -> "已取消訂單。"
                            },
                        )
                    }
                    result.warning?.let { warning ->
                        _uiState.update { it.copy(errorMessage = warning) }
                    }
                    refreshDashboard()
                    // Load announcements
                    runCatching {
                        val ann = repository.loadAnnouncements()
                        _uiState.update { it.copy(announcements = ann) }
                    }
                }
                is ApiResult.Failure -> {
                    _uiState.update { it.copy(errorMessage = result.message) }
                    if (
                        result.message.contains("not available", ignoreCase = true) ||
                        result.message.contains("no longer", ignoreCase = true) ||
                        result.message.contains("已取消", ignoreCase = true) ||
                        result.message.contains("已被其他騎手接走", ignoreCase = true)
                    ) {
                        refreshDashboard()
                    }
                }
            }
        }
    }

    fun cancelPickedUpWithinGrace(orderId: String) {
        viewModelScope.launch {
            when (val result = repository.cancelPickedUpWithinGrace(orderId)) {
                is ApiResult.Success -> {
                    _uiState.update {
                        it.copy(
                            orders = it.orders.filterNot { order -> order.id == orderId },
                            errorMessage = "已取消並釋出訂單，其他騎手可重新接單。",
                        )
                    }
                    refreshDashboard()
                    // Load announcements
                    runCatching {
                        val ann = repository.loadAnnouncements()
                        _uiState.update { it.copy(announcements = ann) }
                    }
                }
                is ApiResult.Failure -> {
                    _uiState.update { it.copy(errorMessage = result.message) }
                    refreshDashboard()
                    // Load announcements
                    runCatching {
                        val ann = repository.loadAnnouncements()
                        _uiState.update { it.copy(announcements = ann) }
                    }
                }
            }
        }
    }


    fun confirmOrderCanceled(orderId: String) {
        viewModelScope.launch {
            when (val result = repository.confirmOrderCanceled(orderId)) {
                is ApiResult.Success -> {
                    _uiState.update {
                        it.copy(
                            orders = it.orders.filterNot { order -> order.id == orderId },
                            errorMessage = "已確認取消。",
                        )
                    }
                    refreshDashboard()
                    // Load announcements
                    runCatching {
                        val ann = repository.loadAnnouncements()
                        _uiState.update { it.copy(announcements = ann) }
                    }
                }
                is ApiResult.Failure -> {
                    _uiState.update { it.copy(errorMessage = result.message) }
                    refreshDashboard()
                    // Load announcements
                    runCatching {
                        val ann = repository.loadAnnouncements()
                        _uiState.update { it.copy(announcements = ann) }
                    }
                }
            }
        }
    }

    fun viewProof(orderId: String) {
        _uiState.update { it.copy(proofViewerOrderId = orderId, proofViewerBytes = null, proofViewerLoading = true) }
        viewModelScope.launch {
            when (val result = repository.fetchProofImage(orderId)) {
                is ApiResult.Success -> _uiState.update {
                    it.copy(proofViewerBytes = result.value, proofViewerLoading = false)
                }
                is ApiResult.Failure -> _uiState.update {
                    it.copy(
                        proofViewerLoading = false,
                        errorMessage = result.message,
                    )
                }
            }
        }
    }

    fun closeProof() {
        _uiState.update { it.copy(proofViewerOrderId = null, proofViewerBytes = null, proofViewerLoading = false) }
    }

    fun markOrderPickedUp(orderId: String) {
        viewModelScope.launch {
            when (val result = repository.markOrderPickedUp(orderId)) {
                is ApiResult.Success -> {
                    _uiState.update { it.copy(orders = it.orders.replaceOrder(result.value)) }
                    result.warning?.let { warning ->
                        _uiState.update { it.copy(errorMessage = warning) }
                    }
                }
                is ApiResult.Failure -> {
                    _uiState.update { it.copy(errorMessage = result.message) }
                    if (result.message.contains("not assigned", ignoreCase = true) || result.message.contains("已分派", ignoreCase = true)) {
                        refreshDashboard()
                    }
                }
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
                    result.warning?.let { warning ->
                        _uiState.update { it.copy(errorMessage = warning) }
                    }
                }
                is ApiResult.Failure -> _uiState.update { it.copy(errorMessage = result.message) }
            }
        }
    }

    fun refreshDashboard(playArrivalSound: Boolean = true) {
        if (_uiState.value.currentDriver == null) return
        viewModelScope.launch {
            val previousOrders = _uiState.value.availableOrders
            val currentCompletedFilter = _uiState.value.completedOrdersFilter
            _uiState.update { it.copy(isRefreshing = true) }
            try {
                val availableOrders = repository.loadAvailableOrders()
                val orders = repository.loadOrders()
                val earnings = repository.loadEarnings()
            val announcements = runCatching { repository.loadAnnouncements() }.getOrDefault(emptyList())
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
                        activeOrderId = orders.firstOrNull()?.id,
                        isRefreshing = false,
                    )
                }
                overdueAlertedOrderIds.retainAll(orders.map { it.id }.toSet())

                val completedPage = repository.loadCompletedOrders(
                    filter = currentCompletedFilter,
                    page = 0,
                )
                _uiState.update {
                    it.copy(
                        completedOrders = completedPage.items,
                        completedOrdersPage = completedPage.page,
                        completedOrdersHasMore = completedPage.hasMore,
                    )
                }

                val previousIds = previousOrders.map { it.id }.toSet()
                val newOrders = availableOrders.filterNot { previousIds.contains(it.id) }
                if (playArrivalSound && newOrders.isNotEmpty()) {
                    val hasUrgentNewOrders = newOrders.any { it.status.isUrgentNew() || it.isUrgent }
                    if (hasUrgentNewOrders) {
                        DriverSoundEffects.playUrgentOrder(AppContextHolder.requireContext())
                    } else {
                        DriverSoundEffects.playNewOrder(AppContextHolder.requireContext())
                    }
                    DriverNotifications.notifyNewOrders(
                        context = AppContextHolder.requireContext(),
                        count = newOrders.size,
                        firstShopName = newOrders.firstOrNull()?.shop?.label,
                        urgent = hasUrgentNewOrders,
                    )
                }
                val newlyOverdueOrders = orders.filter(::isOverdueOrder).filterNot { overdueAlertedOrderIds.contains(it.id) }
                if (newlyOverdueOrders.isNotEmpty()) {
                    overdueAlertedOrderIds.addAll(newlyOverdueOrders.map { it.id })
                    DriverSoundEffects.playOrderOverdue(AppContextHolder.requireContext())
                    _uiState.update {
                        it.copy(errorMessage = "有訂單已超過承諾時間 30 分鐘，請盡快送達。")
                    }
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

    fun refreshCompletedOrders(reset: Boolean = false) {
        if (_uiState.value.currentDriver == null) return
        viewModelScope.launch {
            val filter = _uiState.value.completedOrdersFilter
            val nextPage = if (reset) 0 else _uiState.value.completedOrdersPage + 1
            if (!reset && !_uiState.value.completedOrdersHasMore) return@launch

            _uiState.update { it.copy(isLoadingCompletedOrders = true) }
            try {
                val result = repository.loadCompletedOrders(filter, nextPage)
                _uiState.update { current ->
                    current.copy(
                        completedOrders = if (reset) result.items else current.completedOrders + result.items.filterNot { next -> current.completedOrders.any { it.id == next.id } },
                        completedOrdersPage = result.page,
                        completedOrdersHasMore = result.hasMore,
                        isLoadingCompletedOrders = false,
                    )
                }
            } catch (error: Exception) {
                _uiState.update {
                    it.copy(
                        isLoadingCompletedOrders = false,
                        errorMessage = error.message ?: "無法載入已完成訂單。",
                    )
                }
            }
        }
    }

    fun updateCompletedOrdersFilter(filter: HistoryRange) {
        _uiState.update { it.copy(completedOrdersFilter = filter) }
        refreshCompletedOrders(reset = true)
    }

    fun updateEarningsFilter(filter: HistoryRange) {
        _uiState.update { it.copy(earningsFilter = filter) }
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

private fun isOverdueOrder(order: Order): Boolean {
    if (order.status != OrderStatus.PICKED_UP && order.status != OrderStatus.HEADING_TO_CUSTOMER) {
        return false
    }

    val promisedAt = order.promisedAt ?: return false
    val promisedTime = runCatching { OffsetDateTime.parse(promisedAt) }.getOrNull() ?: return false
    return OffsetDateTime.now().isAfter(promisedTime.plusMinutes(30))
}

private fun isValidPin(value: String): Boolean {
    return value.length == 4 && value.all { it.isDigit() }
}
