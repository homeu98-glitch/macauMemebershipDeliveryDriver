package com.membershipdeliverydriver.app

import android.Manifest
import android.content.Intent
import android.graphics.Bitmap
import android.net.Uri
import android.os.Build
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.clickable
import androidx.compose.foundation.Image
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.background
import androidx.compose.foundation.BorderStroke
import androidx.compose.material.ExperimentalMaterialApi
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.material.pullrefresh.pullRefresh
import androidx.compose.material.pullrefresh.rememberPullRefreshState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.Directions
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.ListAlt
import androidx.compose.material.icons.filled.Login
import androidx.compose.material.icons.filled.MonetizationOn
import androidx.compose.material.icons.filled.MoreTime
import androidx.compose.material.icons.filled.PhotoCamera
import androidx.compose.material.icons.filled.Place
import androidx.compose.material.icons.filled.ReportProblem
import androidx.compose.material.icons.filled.TaskAlt
import androidx.compose.material.icons.filled.VerifiedUser
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.CenterAlignedTopAppBar
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.IntOffset
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.graphics.asImageBitmap
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.membershipdeliverydriver.app.core.ApprovalStatus
import com.membershipdeliverydriver.app.core.AppContextHolder
import com.membershipdeliverydriver.app.core.DriverAvailability
import com.membershipdeliverydriver.app.core.DriverViewModel
import com.membershipdeliverydriver.app.core.Order
import com.membershipdeliverydriver.app.core.OrderStatus
import com.membershipdeliverydriver.app.core.isCanceledLike
import com.membershipdeliverydriver.app.core.isDriverCanceled
import com.membershipdeliverydriver.app.core.isShopOwnerCanceled
import com.membershipdeliverydriver.app.core.isUrgentNew
import com.membershipdeliverydriver.app.core.LeaderboardEntry
import java.time.format.DateTimeFormatter
import java.time.Duration
import java.time.OffsetDateTime
import kotlinx.coroutines.delay

private object Routes {
    const val Login = "login"
    const val Register = "register"
    const val PendingApproval = "pendingApproval"
    const val Home = "home"
    const val Orders = "orders"
    const val Completed = "completed"
    const val OrderDetail = "orderDetail"
    const val Profile = "profile"
    const val Leaderboard = "leaderboard"
}

@Composable
fun DriverApp(viewModel: DriverViewModel = viewModel()) {
    val navController = rememberNavController()
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val snackbarHostState = remember { SnackbarHostState() }
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route
    val context = LocalContext.current
    val notificationPermissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { }
    val locationPermissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { }

    LaunchedEffect(uiState.errorMessage) {
        uiState.errorMessage?.let { message ->
            snackbarHostState.showSnackbar(message)
            viewModel.clearError()
        }
    }


    if (uiState.updateInfo != null) {
        val info = uiState.updateInfo!!
        AlertDialog(
            onDismissRequest = viewModel::dismissUpdateInfo,
            title = { Text("發現新版本 ${info.version}") },
            text = { Text(if (info.releaseNotes.isBlank()) "有新版本可更新。" else info.releaseNotes) },
            confirmButton = {
                TextButton(
                    onClick = {
                        runCatching {
                            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(info.downloadPageUrl))
                            context.startActivity(intent)
                        }
                    }
                ) { Text("立即更新") }
            },
            dismissButton = {
                TextButton(onClick = viewModel::dismissUpdateInfo) { Text("稍後") }
            }
        )
    }

    LaunchedEffect(uiState.currentDriver, currentRoute) {
        if (uiState.currentDriver != null) {
            if (currentRoute in setOf(Routes.Login, Routes.Register, Routes.PendingApproval)) {
                navController.navigate(Routes.Home) {
                    popUpTo(Routes.Login) { inclusive = true }
                    launchSingleTop = true
                }
            }
        } else if (currentRoute !in setOf(Routes.Login, Routes.Register, Routes.PendingApproval)) {
            navController.navigate(Routes.Login) {
                popUpTo(navController.graph.findStartDestination().id) { inclusive = true }
                launchSingleTop = true
            }
        }
    }

    LaunchedEffect(uiState.currentDriver) {
        if (
            uiState.currentDriver != null &&
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.POST_NOTIFICATIONS
            ) != PackageManager.PERMISSION_GRANTED
        ) {
            notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
    }

    LaunchedEffect(true) {
        if (
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.ACCESS_FINE_LOCATION
            ) != PackageManager.PERMISSION_GRANTED
        ) {
            locationPermissionLauncher.launch(Manifest.permission.ACCESS_FINE_LOCATION)
        }
    }

    LaunchedEffect(uiState.currentDriver?.id, uiState.currentDriver?.availability) {
        if (uiState.currentDriver?.availability != DriverAvailability.ONLINE) return@LaunchedEffect
        while (true) {
            delay(15000)
            viewModel.refreshDashboard()
        }
    }

    LaunchedEffect(uiState.currentDriver?.id) {
        if (uiState.currentDriver == null) return@LaunchedEffect
        com.membershipdeliverydriver.app.core.DriverMqttManager.realtimeEvents.collect {
            viewModel.onPushOrderUpdate()
        }
    }

    LaunchedEffect(currentRoute, uiState.currentDriver?.id) {
        if (uiState.currentDriver == null) return@LaunchedEffect
        if (currentRoute == Routes.Profile) {
            viewModel.refreshAnnouncements()
            viewModel.checkForUpdates()
        }
    }

    val startDestination = if (uiState.currentDriver == null) Routes.Login else Routes.Home

    Scaffold(
        modifier = Modifier.fillMaxSize(),
        snackbarHost = { SnackbarHost(hostState = snackbarHostState) },
        bottomBar = {
            if (uiState.currentDriver != null && currentRoute in mainRoutes) {
                DriverBottomBar(navController = navController)
            }
        },
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = startDestination,
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding),
        ) {
            composable(Routes.Login) {
                LoginScreen(
                    phone = uiState.loginForm.phone,
                    password = uiState.loginForm.password,
                    isLoading = uiState.isLoading,
                    onPhoneChanged = viewModel::updateLoginPhone,
                    onPasswordChanged = viewModel::updateLoginPassword,
                    onLogin = viewModel::login,
                    onRegister = { navController.navigate(Routes.Register) },
                    onPendingApproval = { navController.navigate(Routes.PendingApproval) },
                )
            }
            composable(Routes.Register) {
                RegistrationScreen(
                    viewModel = viewModel,
                    onBack = { navController.popBackStack() },
                    onSubmitted = {
                        navController.navigate(Routes.PendingApproval) {
                            popUpTo(Routes.Register) { inclusive = true }
                        }
                    },
                )
            }
            composable(Routes.PendingApproval) {
                PendingApprovalScreen(
                    onBackToLogin = {
                        navController.navigate(Routes.Login) {
                            popUpTo(navController.graph.findStartDestination().id) { inclusive = true }
                            launchSingleTop = true
                        }
                    },
                )
            }
            composable(Routes.Home) {
                HomeScreen(
                    uiState = uiState,
                    onToggleAvailability = viewModel::toggleAvailability,
                    onAcceptOrder = viewModel::acceptOrder,
                    onRefresh = viewModel::refreshDashboard,
                    onSelectPickupDistrict = viewModel::selectPickupDistrictFilter,
                    onClearPickupDistrict = viewModel::clearPickupDistrictFilter,
                    onSelectDestinationDistrict = viewModel::selectDestinationDistrictFilter,
                    onClearDestinationDistrict = viewModel::clearDestinationDistrictFilter,
                )
            }
            composable(Routes.Orders) {
                OrdersScreen(
                    uiState = uiState,
                    orders = uiState.orders,
                    onRefresh = viewModel::refreshDashboard,
                    onMarkPickedUp = viewModel::markOrderPickedUp,
                    onProofSelected = viewModel::uploadProofOfDelivery,
                    onCancelOrder = viewModel::cancelOrder,
                    onGraceCancel = viewModel::cancelPickedUpWithinGrace,
                    onConfirmCanceled = viewModel::confirmOrderCanceled,
                )
            }
            composable(Routes.Completed) {
                CompletedOrdersScreen(
                    uiState = uiState,
                    onFilterSelected = viewModel::updateCompletedOrdersFilter,
                    onLoadMore = { viewModel.refreshCompletedOrders(reset = false) },
                    onViewProof = viewModel::viewProof,
                    onCloseProof = viewModel::closeProof,
                )
            }
            composable(Routes.OrderDetail) {
                val activeOrder = uiState.orders.firstOrNull { it.id == uiState.activeOrderId }
                OrderDetailScreen(
                    order = activeOrder,
                    onBack = { navController.popBackStack() },
                    onProofSelected = { uri ->
                        activeOrder?.let { viewModel.uploadProofOfDelivery(it.id, uri) }
                    },
                    onReportIssue = { note ->
                        activeOrder?.let { viewModel.reportIssue(it.id, note) }
                    },
                )
            }
            composable(Routes.Profile) {
                ProfileScreen(
                    uiState = uiState,
                    onEarningsFilterSelected = viewModel::updateEarningsFilter,
                    onCheckForUpdates = { viewModel.checkForUpdates(manual = true) },
                    onRefreshAnnouncements = { viewModel.refreshAnnouncements(showMessage = true) },
                    onOpenLeaderboard = { navController.navigate(Routes.Leaderboard) },
                    onChangePin = viewModel::changePin,
                    onLogout = viewModel::logout,
                )
            }


composable(Routes.Leaderboard) {
    LeaderboardScreen(
        uiState = uiState,
        onBack = { navController.popBackStack() },
        onRefresh = viewModel::loadWeeklyLeaderboard,
    )
}
        }
    }
}

private val mainRoutes = setOf(Routes.Home, Routes.Orders, Routes.Completed, Routes.Profile)

@Composable
private fun DriverBottomBar(navController: NavHostController) {
    val backStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = backStackEntry?.destination?.route
    val items = listOf(
        BottomNavItem("首頁", Routes.Home, Icons.Default.Home),
        BottomNavItem("訂單", Routes.Orders, Icons.Default.ListAlt),
        BottomNavItem("完成", Routes.Completed, Icons.Default.TaskAlt),
        BottomNavItem("我的", Routes.Profile, Icons.Default.VerifiedUser),
    )

    NavigationBar(modifier = Modifier.navigationBarsPadding()) {
        items.forEach { item ->
            NavigationBarItem(
                selected = currentRoute == item.route,
                onClick = {
                    navController.navigate(item.route) {
                        popUpTo(navController.graph.findStartDestination().id) {
                            saveState = true
                        }
                        launchSingleTop = true
                        restoreState = true
                    }
                },
                icon = { Icon(item.icon, contentDescription = item.label) },
                label = { Text(item.label) },
            )
        }
    }
}

private data class BottomNavItem(
    val label: String,
    val route: String,
    val icon: androidx.compose.ui.graphics.vector.ImageVector,
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun LoginScreen(
    phone: String,
    password: String,
    isLoading: Boolean,
    onPhoneChanged: (String) -> Unit,
    onPasswordChanged: (String) -> Unit,
    onLogin: () -> Unit,
    onRegister: () -> Unit,
    onPendingApproval: () -> Unit,
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFFFF8EE))
            .safeDrawingPadding()
            .padding(20.dp),
        contentAlignment = Alignment.Center,
    ) {
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(30.dp),
            colors = CardDefaults.cardColors(containerColor = Color.White),
            border = BorderStroke(1.dp, Color(0xFFF0DFC0))
        ) {
            Column(
                modifier = Modifier.padding(22.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp),
            ) {
                Surface(shape = RoundedCornerShape(999.dp), color = Color(0xFFFFE9A6)) {
                    Text(
                        "騎手登入",
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                        color = Color(0xFF6E4A00),
                        style = MaterialTheme.typography.labelLarge,
                        fontWeight = FontWeight.SemiBold,
                    )
                }
                Text("會員配送騎手", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
                Text(
                    "使用電話登入，接單、導航、上傳送達證明與異常回報都會直接連接真實資料。",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                OutlinedTextField(
                    value = phone,
                    onValueChange = onPhoneChanged,
                    label = { Text("電話號碼") },
                    modifier = Modifier.fillMaxWidth(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                    singleLine = true,
                    shape = RoundedCornerShape(14.dp),
                )
                OutlinedTextField(
                    value = password,
                    onValueChange = onPasswordChanged,
                    label = { Text("密碼（4 位數字）") },
                    modifier = Modifier.fillMaxWidth(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                    visualTransformation = PasswordVisualTransformation(),
                    singleLine = true,
                    shape = RoundedCornerShape(14.dp),
                )
                Button(
                    onClick = onLogin,
                    modifier = Modifier.fillMaxWidth(),
                    enabled = !isLoading,
                    shape = RoundedCornerShape(14.dp),
                ) {
                    Text(if (isLoading) "登入中..." else "登入")
                }
                Text(
                    "請輸入 4 位數字密碼。若你剛完成註冊，帳號需等待後台審核通過後才能正式接單。",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    OutlinedButton(
                        onClick = onRegister,
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(14.dp),
                        border = BorderStroke(1.dp, Color(0xFFF1D99A))
                    ) {
                        Text("立即註冊")
                    }
                    OutlinedButton(
                        onClick = onPendingApproval,
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(14.dp),
                        border = BorderStroke(1.dp, Color(0xFFF1D99A))
                    ) {
                        Text("查看審核")
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun RegistrationScreen(
    viewModel: DriverViewModel,
    onBack: () -> Unit,
    onSubmitted: () -> Unit,
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val registration = uiState.registrationForm
    var pickerType by remember { mutableStateOf<DriverViewModel.DocumentType?>(null) }
    val pickerLauncher = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        if (uri != null && pickerType != null) {
            viewModel.updateRegistrationDocument(pickerType!!, uri)
        }
    }

    Scaffold(
        containerColor = Color(0xFFFFF8EE),
        topBar = {
            CenterAlignedTopAppBar(
                title = { Text("騎手註冊") },
                navigationIcon = {
                    TextButton(onClick = onBack) { Text("返回") }
                },
                colors = TopAppBarDefaults.centerAlignedTopAppBarColors(
                    containerColor = Color(0xFFFFF8EE)
                )
            )
        },
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .background(Color(0xFFFFF8EE))
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Card(
                shape = RoundedCornerShape(14.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                border = BorderStroke(1.dp, Color(0xFFF0DFC0))
            ) {
                Column(
                    modifier = Modifier.padding(18.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Text(
                        "請先填寫資料並上傳自拍照、澳門身份證與駕駛執照，後台審核通過後即可登入接單。",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    OutlinedTextField(
                        value = registration.fullName,
                        onValueChange = viewModel::updateRegistrationName,
                        label = { Text("姓名") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        shape = RoundedCornerShape(14.dp),
                    )
                    OutlinedTextField(
                        value = registration.phone,
                        onValueChange = viewModel::updateRegistrationPhone,
                        label = { Text("電話號碼") },
                        modifier = Modifier.fillMaxWidth(),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                        singleLine = true,
                        shape = RoundedCornerShape(14.dp),
                    )
                    OutlinedTextField(
                        value = registration.password,
                        onValueChange = viewModel::updateRegistrationPassword,
                        label = { Text("密碼（4 位數字）") },
                        modifier = Modifier.fillMaxWidth(),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                        visualTransformation = PasswordVisualTransformation(),
                        singleLine = true,
                        shape = RoundedCornerShape(14.dp),
                    )
                }
            }

            UploadTile(
                title = "上傳自拍照",
                description = registration.selfie.uri?.toString() ?: "用於身份比對，請上傳清晰正面照片。",
                onUpload = {
                    pickerType = DriverViewModel.DocumentType.SELFIE
                    pickerLauncher.launch("image/*")
                },
            )
            UploadTile(
                title = "上傳澳門身份證",
                description = registration.macauId.uri?.toString() ?: "請上傳可清楚辨識資料的證件圖片。",
                onUpload = {
                    pickerType = DriverViewModel.DocumentType.MACAU_ID
                    pickerLauncher.launch("image/*")
                },
            )
            UploadTile(
                title = "上傳駕駛執照",
                description = registration.drivingLicence.uri?.toString() ?: "請上傳有效駕駛執照圖片。",
                onUpload = {
                    pickerType = DriverViewModel.DocumentType.DRIVING_LICENCE
                    pickerLauncher.launch("image/*")
                },
            )

            Button(
                onClick = { viewModel.submitRegistration(onSubmitted) },
                modifier = Modifier.fillMaxWidth(),
                enabled = !uiState.isLoading,
                shape = RoundedCornerShape(14.dp),
            ) {
                Icon(Icons.Default.VerifiedUser, contentDescription = null)
                Spacer(modifier = Modifier.size(8.dp))
                Text(if (uiState.isLoading) "提交中..." else "提交審核")
            }
        }
    }
}

@Composable
private fun UploadTile(
    title: String,
    description: String,
    onUpload: () -> Unit,
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(24.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        border = BorderStroke(1.dp, Color(0xFFF0DFC0)),
    ) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(title, fontWeight = FontWeight.SemiBold)
            Text(
                description,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
            OutlinedButton(
                onClick = onUpload,
                shape = RoundedCornerShape(14.dp),
                border = BorderStroke(1.dp, Color(0xFFF1D99A))
            ) {
                Icon(Icons.Default.CameraAlt, contentDescription = null)
                Spacer(modifier = Modifier.size(8.dp))
                Text("選擇圖片")
            }
        }
    }
}

@Composable
private fun PendingApprovalScreen(
    onBackToLogin: () -> Unit,
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFFFF8EE))
            .safeDrawingPadding()
            .padding(20.dp),
        contentAlignment = Alignment.Center,
    ) {
        Card(
            shape = RoundedCornerShape(28.dp),
            colors = CardDefaults.cardColors(containerColor = Color.White),
            border = BorderStroke(1.dp, Color(0xFFF0DFC0))
        ) {
            Column(
                modifier = Modifier.padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Text("申請已送出，等待審核", style = MaterialTheme.typography.headlineSmall)
                Text(
                    "後台會審核你的自拍照、澳門身份證與駕駛執照。審核通過後，你就可以正式登入並接收訂單。",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text(
                    "如果審核還未完成，請稍後再登入查看。",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Button(
                    onClick = onBackToLogin,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(18.dp)
                ) {
                    Text("返回登入")
                }
            }
        }
    }
}


@OptIn(ExperimentalMaterialApi::class)
@Composable
private fun HomeScreen(
    uiState: com.membershipdeliverydriver.app.core.DriverAppState,
    onToggleAvailability: () -> Unit,
    onAcceptOrder: (String) -> Unit,
    onRefresh: () -> Unit,
    onSelectPickupDistrict: (String) -> Unit,
    onClearPickupDistrict: () -> Unit,
    onSelectDestinationDistrict: (String) -> Unit,
    onClearDestinationDistrict: () -> Unit,
) {
    val context = LocalContext.current
    val driver = uiState.currentDriver
    val pullRefreshState = rememberPullRefreshState(
        refreshing = uiState.isRefreshing,
        onRefresh = onRefresh,
    )
    var expandedFilter by rememberSaveable { mutableStateOf<String?>(null) }

    val destinationOptions = remember(uiState.availableOrders, uiState.pickupDistrictFilter) {
        uiState.availableOrders
            .filter { order -> uiState.pickupDistrictFilter.isEmpty() || order.shop.district in uiState.pickupDistrictFilter }
            .mapNotNull { it.customer.district?.takeIf(String::isNotBlank) }
            .distinct()
            .sorted()
    }
    val pickupOptions = remember(uiState.availableOrders, uiState.destinationDistrictFilter) {
        uiState.availableOrders
            .filter { order -> uiState.destinationDistrictFilter.isEmpty() || order.customer.district in uiState.destinationDistrictFilter }
            .mapNotNull { it.shop.district?.takeIf(String::isNotBlank) }
            .distinct()
            .sorted()
    }
    val filteredOrders = remember(uiState.availableOrders, uiState.pickupDistrictFilter, uiState.destinationDistrictFilter) {
        uiState.availableOrders.filter { order ->
            (uiState.pickupDistrictFilter.isEmpty() || order.shop.district in uiState.pickupDistrictFilter) &&
                (uiState.destinationDistrictFilter.isEmpty() || order.customer.district in uiState.destinationDistrictFilter)
        }
    }
    val pickupSummary = remember(uiState.pickupDistrictFilter) {
        when {
            uiState.pickupDistrictFilter.isEmpty() -> "全部"
            uiState.pickupDistrictFilter.size <= 2 -> uiState.pickupDistrictFilter.sorted().joinToString("、")
            else -> "已選 ${uiState.pickupDistrictFilter.size} 區"
        }
    }
    val destinationSummary = remember(uiState.destinationDistrictFilter) {
        when {
            uiState.destinationDistrictFilter.isEmpty() -> "全部"
            uiState.destinationDistrictFilter.size <= 2 -> uiState.destinationDistrictFilter.sorted().joinToString("、")
            else -> "已選 ${uiState.destinationDistrictFilter.size} 區"
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFFFF8EE))
            .pullRefresh(pullRefreshState)
    ) {
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .safeDrawingPadding(),
            contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 12.dp, bottom = 28.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            item {
                Surface(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(24.dp)),
                    shape = RoundedCornerShape(24.dp),
                    color = Color(0xFFFFC93D),
                    tonalElevation = 0.dp,
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 18.dp, vertical = 14.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Column(
                            modifier = Modifier.weight(1f),
                            verticalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            Text(
                                "接單狀態",
                                color = Color(0xFF6F4600),
                                style = MaterialTheme.typography.labelLarge,
                                fontWeight = FontWeight.SemiBold,
                            )
                            Text(
                                availabilityLabel(driver?.availability ?: DriverAvailability.OFFLINE),
                                color = Color(0xFF2A1A00),
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold,
                            )
                            Text(
                                if (driver?.availability == DriverAvailability.ONLINE)
                                    "保持上線即可即時看到新工單。"
                                else
                                    "切換上線後才可以開始接單。",
                                color = Color(0xFF6D4B0B),
                                style = MaterialTheme.typography.bodySmall,
                            )
                        }
                        Spacer(modifier = Modifier.width(10.dp))
                        Switch(
                            checked = driver?.availability == DriverAvailability.ONLINE,
                            onCheckedChange = { onToggleAvailability() },
                        )
                    }
                }
            }
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        Text("可接訂單", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(6.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text(
                                "向下拉即可即時刷新",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                    Surface(
                        shape = RoundedCornerShape(999.dp),
                        color = Color(0xFFFFE9A6),
                        border = BorderStroke(1.dp, Color(0xFFF6D56A))
                    ) {
                        Text(
                            text = "${filteredOrders.size} 張",
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 7.dp),
                            color = Color(0xFF6E4A00),
                            style = MaterialTheme.typography.labelLarge,
                            fontWeight = FontWeight.SemiBold,
                        )
                    }
                }
            }
            item {
                Surface(
                    modifier = Modifier.fillMaxWidth().animateContentSize(),
                    shape = RoundedCornerShape(14.dp),
                    color = Color.White,
                    border = BorderStroke(1.dp, Color(0xFFF1E0BE))
                ) {
                    Column(modifier = Modifier.fillMaxWidth()) {
                        Row(modifier = Modifier.fillMaxWidth()) {
                            TextButton(
                                onClick = { expandedFilter = if (expandedFilter == "pickup") null else "pickup" },
                                modifier = Modifier.weight(1f),
                            ) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically,
                                ) {
                                    Column(horizontalAlignment = Alignment.Start) {
                                        Text("取貨地區", color = Color(0xFF6C7F93), style = MaterialTheme.typography.labelSmall)
                                        Text(
                                            pickupSummary,
                                            style = MaterialTheme.typography.bodyMedium,
                                            color = Color(0xFF2E4765),
                                            fontWeight = FontWeight.SemiBold,
                                        )
                                    }
                                    Icon(Icons.Default.ArrowDropDown, contentDescription = null, tint = Color(0xFF2E4765))
                                }
                            }
                            Box(
                                modifier = Modifier
                                    .width(1.dp)
                                    .height(54.dp)
                                    .background(Color(0xFFF1E0BE))
                            )
                            TextButton(
                                onClick = { expandedFilter = if (expandedFilter == "destination") null else "destination" },
                                modifier = Modifier.weight(1f),
                            ) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically,
                                ) {
                                    Column(horizontalAlignment = Alignment.Start) {
                                        Text("送達地區", color = Color(0xFF6C7F93), style = MaterialTheme.typography.labelSmall)
                                        Text(
                                            destinationSummary,
                                            style = MaterialTheme.typography.bodyMedium,
                                            color = Color(0xFF2E4765),
                                            fontWeight = FontWeight.SemiBold,
                                        )
                                    }
                                    Icon(Icons.Default.ArrowDropDown, contentDescription = null, tint = Color(0xFF2E4765))
                                }
                            }
                        }

                        AnimatedVisibility(visible = expandedFilter == "pickup") {
                            DistrictFilterInlinePanel(
                                title = "選擇取貨地區",
                                options = pickupOptions,
                                selected = uiState.pickupDistrictFilter,
                                onToggle = onSelectPickupDistrict,
                                onClear = onClearPickupDistrict,
                            )
                        }

                        AnimatedVisibility(visible = expandedFilter == "destination") {
                            DistrictFilterInlinePanel(
                                title = "選擇送達地區",
                                options = destinationOptions,
                                selected = uiState.destinationDistrictFilter,
                                onToggle = onSelectDestinationDistrict,
                                onClear = onClearDestinationDistrict,
                            )
                        }
                    }
                }
            }
            if (filteredOrders.isEmpty()) {
                item {
                    FriendlyEmptyState(
                        title = if (uiState.availableOrders.isEmpty()) "暫時還沒有新單" else "目前沒有符合篩選的訂單",
                        subtitle = if (uiState.availableOrders.isEmpty()) "先休息一下，保持上線並下拉刷新，下一張單很快就會來。" else "請調整上方的取貨地區或送達地區篩選。",
                    )
                }
            }
            items(filteredOrders, key = { it.id }) { order ->
                AvailableOrderCard(
                    order = order,
                    isOnline = driver?.availability == DriverAvailability.ONLINE,
                    isAccepting = uiState.acceptingOrderId == order.id,
                    acceptActionLocked = uiState.acceptingOrderId != null,
                    onNavigateToShop = {
                        openNavigation(context, order.shop)
                    },
                    onAcceptOrder = { onAcceptOrder(order.id) },
                )
            }
        }
        CuteDriverPullRefreshIndicator(
            refreshing = uiState.isRefreshing,
            progress = pullRefreshState.progress,
            modifier = Modifier.align(Alignment.TopCenter),
        )
    }
}

@Composable
private fun DistrictFilterInlinePanel(
    title: String,
    options: List<String>,
    selected: Set<String>,
    onToggle: (String) -> Unit,
    onClear: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color(0xFFFFFBF1))
            .padding(horizontal = 12.dp, vertical = 10.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(title, style = MaterialTheme.typography.labelLarge, color = Color(0xFF2E4765), fontWeight = FontWeight.SemiBold)
                Text("可多選，會即時篩選首頁訂單", style = MaterialTheme.typography.bodySmall, color = Color(0xFF6C7F93))
            }
            TextButton(onClick = onClear, enabled = selected.isNotEmpty()) {
                Text("清除")
            }
        }

        Column(
            modifier = Modifier
                .fillMaxWidth()
                .heightIn(max = 260.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(2.dp)
        ) {
            if (options.isEmpty()) {
                Text(
                    "目前沒有可選地區。",
                    modifier = Modifier.padding(vertical = 8.dp),
                    style = MaterialTheme.typography.bodySmall,
                    color = Color(0xFF6C7F93),
                )
            } else {
                options.forEach { district ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(12.dp))
                            .clickable { onToggle(district) }
                            .padding(horizontal = 4.dp, vertical = 2.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween,
                    ) {
                        Text(
                            district,
                            modifier = Modifier.weight(1f),
                            style = MaterialTheme.typography.bodyMedium,
                            color = Color(0xFF2E4765),
                        )
                        Checkbox(
                            checked = district in selected,
                            onCheckedChange = { onToggle(district) }
                        )
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterialApi::class)
@Composable
private fun OrdersScreen(
    uiState: com.membershipdeliverydriver.app.core.DriverAppState,
    orders: List<Order>,
    onRefresh: () -> Unit,
    onMarkPickedUp: (String) -> Unit,
    onProofSelected: (String, Uri) -> Unit,
    onCancelOrder: (String, String, String?, com.membershipdeliverydriver.app.core.CancelHandling) -> Unit,
    onGraceCancel: (String) -> Unit,
    onConfirmCanceled: (String) -> Unit,
) {
    val context = LocalContext.current
    val pullRefreshState = rememberPullRefreshState(
        refreshing = uiState.isRefreshing,
        onRefresh = onRefresh,
    )
    var completionOrderId by rememberSaveable { mutableStateOf<String?>(null) }
    var cancelOrderId by rememberSaveable { mutableStateOf<String?>(null) }
    var cancelReason by rememberSaveable { mutableStateOf("臨時有事無法配送") }
    var cancelOtherReason by rememberSaveable { mutableStateOf("") }
    var cancelHandling by rememberSaveable { mutableStateOf(com.membershipdeliverydriver.app.core.CancelHandling.RETURN_TO_SHOP) }
    val galleryLauncher = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        val orderId = completionOrderId
        completionOrderId = null
        if (uri != null && orderId != null) {
            onProofSelected(orderId, uri)
        }
    }
    val cameraLauncher = rememberLauncherForActivityResult(ActivityResultContracts.TakePicturePreview()) { bitmap ->
        val orderId = completionOrderId
        val uri = if (bitmap != null) bitmapToCacheUri(context, bitmap) else null
        completionOrderId = null
        if (uri != null && orderId != null) {
            onProofSelected(orderId, uri)
        }
    }
    val activeOrders = orders.filterNot { it.status == OrderStatus.DELIVERED || (it.status.isCanceledLike() && !it.deliveredAt.isNullOrBlank()) }
    var rewardOrder by remember { mutableStateOf<Order?>(null) }
    val latestCompletedOrder = uiState.completedOrders.firstOrNull()
    LaunchedEffect(latestCompletedOrder?.id) {
        if (latestCompletedOrder != null && !latestCompletedOrder.status.isCanceledLike()) {
            rewardOrder = latestCompletedOrder
            delay(2200)
            if (rewardOrder?.id == latestCompletedOrder.id) rewardOrder = null
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFFFF8EE))
            .pullRefresh(pullRefreshState)
    ) {
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .safeDrawingPadding(),
            contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 12.dp, bottom = 28.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text("正在進行的訂單", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                    Surface(
                        shape = RoundedCornerShape(999.dp),
                        color = Color(0xFFFFE9A6),
                        border = BorderStroke(1.dp, Color(0xFFF6D56A))
                    ) {
                        Text(
                            text = "${activeOrders.size} 單",
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 7.dp),
                            color = Color(0xFF6E4A00),
                            style = MaterialTheme.typography.labelLarge,
                            fontWeight = FontWeight.SemiBold,
                        )
                    }
                }
            }
            if (activeOrders.isEmpty()) {
                item {
                    FriendlyEmptyState(
                        title = "目前沒有進行中的訂單",
                        subtitle = "準備好後接下一張單，這裡會即時顯示你的配送進度。",
                    )
                }
            }
            items(activeOrders.size, key = { index -> activeOrders[index].id }) { index ->
                val order = activeOrders[index]
                ActiveOrderCard(
                    displayLabel = "訂單 ${index + 1}",
                    order = order,
                    onNavigateToShop = {
                        openNavigation(context, order.shop)
                    },
                    onCallShop = { openDialer(context, order.shop.contactPhone) },
                    onNavigateToCustomer = {
                        openNavigation(context, order.customer)
                    },
                    onCallCustomer = { openDialer(context, order.customer.contactPhone) },
                    onMarkPickedUp = { onMarkPickedUp(order.id) },
                    onCompleteOrder = {
                        completionOrderId = order.id
                    },
                    onGraceCancel = { onGraceCancel(order.id) },
                    onConfirmCanceled = { onConfirmCanceled(order.id) },
                    onCancelOrder = {
                        cancelOrderId = order.id
                        cancelReason = "臨時有事無法配送"
                        cancelOtherReason = ""
                        cancelHandling = com.membershipdeliverydriver.app.core.CancelHandling.RETURN_TO_SHOP
                    },
                )
            }
        }
        if (completionOrderId != null) {
            AlertDialog(
                onDismissRequest = { completionOrderId = null },
                title = { Text("拍照後完成訂單") },
                text = { Text("請選擇直接拍照，或從相簿上傳送達圖片。") },
                confirmButton = {
                    TextButton(
                        onClick = {
                            cameraLauncher.launch(null)
                        }
                    ) {
                        Text("拍照")
                    }
                },
                dismissButton = {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        TextButton(
                            onClick = {
                                galleryLauncher.launch("image/*")
                            }
                        ) {
                            Text("相簿")
                        }
                        TextButton(onClick = { completionOrderId = null }) {
                            Text("取消")
                        }
                    }
                }
            )
        }
        if (cancelOrderId != null) {
            AlertDialog(
                onDismissRequest = { cancelOrderId = null },
                title = { Text("取消訂單") },
                text = {
                    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        Text("請選擇取消原因與處理方式。")
                        HistoryChoiceChips(
                            options = listOf("臨時有事無法配送", "車輛故障", "身體不適", "其他"),
                            selected = cancelReason,
                            onSelected = { cancelReason = it },
                        )
                        if (cancelReason == "其他") {
                            OutlinedTextField(
                                value = cancelOtherReason,
                                onValueChange = { cancelOtherReason = it },
                                label = { Text("請輸入原因") },
                                modifier = Modifier.fillMaxWidth(),
                            )
                        }
                        HistoryChoiceChips(
                            options = listOf("退回商戶", "不退回"),
                            selected = if (cancelHandling == com.membershipdeliverydriver.app.core.CancelHandling.RETURN_TO_SHOP) "退回商戶" else "不退回",
                            onSelected = {
                                cancelHandling =
                                    if (it == "退回商戶") {
                                        com.membershipdeliverydriver.app.core.CancelHandling.RETURN_TO_SHOP
                                    } else {
                                        com.membershipdeliverydriver.app.core.CancelHandling.NOT_RETURNING
                                    }
                            },
                        )
                    }
                },
                confirmButton = {
                    TextButton(
                        onClick = {
                            val orderId = cancelOrderId ?: return@TextButton
                            onCancelOrder(
                                orderId,
                                cancelReason,
                                cancelOtherReason.takeIf { cancelReason == "其他" && it.isNotBlank() },
                                cancelHandling,
                            )
                            cancelOrderId = null
                        }
                    ) { Text("確認取消") }
                },
                dismissButton = {
                    TextButton(onClick = { cancelOrderId = null }) { Text("返回") }
                }
            )
        }
        CuteDriverPullRefreshIndicator(
            refreshing = uiState.isRefreshing,
            progress = pullRefreshState.progress,
            modifier = Modifier.align(Alignment.TopCenter),
        )
    }
}

@Composable
private fun PaymentTagChip(label: String) {
    val isShopPaid = label.contains("商家") || label.contains("商戶")
    Surface(
        shape = RoundedCornerShape(10.dp),
        color = if (isShopPaid) Color(0xFFE9F7EF) else Color(0xFFEAF2FF),
        border = BorderStroke(1.dp, if (isShopPaid) Color(0xFFB7DEC4) else Color(0xFFBED2F2))
    ) {
        Text(
            label,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
            style = MaterialTheme.typography.labelSmall,
            color = if (isShopPaid) Color(0xFF22663A) else Color(0xFF234A84),
            fontWeight = FontWeight.SemiBold,
        )
    }
}


@Composable
private fun AvailableOrderCard(
    order: Order,
    isOnline: Boolean,
    isAccepting: Boolean,
    acceptActionLocked: Boolean,
    onNavigateToShop: () -> Unit,
    onAcceptOrder: () -> Unit,
) {
    var cardVisible by remember(order.id) { mutableStateOf(false) }
    var showArrivalGlow by remember(order.id) { mutableStateOf(true) }
    val borderColor by animateColorAsState(
        targetValue = if (showArrivalGlow) Color(0xFFFFC84A) else Color(0xFFF0DFC0),
        animationSpec = tween(850),
        label = "availableBorder",
    )
    val cardScale by animateFloatAsState(
        targetValue = if (showArrivalGlow) 1.015f else 1f,
        animationSpec = tween(550),
        label = "availableScale",
    )
    val urgentPulse = if (order.isUrgent) {
        rememberInfiniteTransition(label = "urgentPulse")
            .animateFloat(
                initialValue = 0.95f,
                targetValue = 1.05f,
                animationSpec = infiniteRepeatable(tween(700, easing = FastOutSlowInEasing), RepeatMode.Reverse),
                label = "urgentPulseValue",
            ).value
    } else 1f

    LaunchedEffect(order.id) {
        cardVisible = true
        delay(1800)
        showArrivalGlow = false
    }

    AnimatedVisibility(
        visible = cardVisible,
        enter = slideInVertically(initialOffsetY = { it / 3 }) + fadeIn(animationSpec = tween(320)),
        exit = fadeOut(animationSpec = tween(180)) + slideOutVertically(targetOffsetY = { -it / 5 }),
    ) {
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .graphicsLayer {
                    scaleX = cardScale
                    scaleY = cardScale
                }
                .animateContentSize(),
            shape = RoundedCornerShape(14.dp),
            colors = CardDefaults.cardColors(containerColor = Color.White),
            border = BorderStroke(1.dp, borderColor)
        ) {
            Column(
                modifier = Modifier.padding(horizontal = 10.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(5.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column(
                        modifier = Modifier.weight(1f),
                        verticalArrangement = Arrangement.spacedBy(2.dp)
                    ) {
                        if (order.isUrgent) {
                            Text(
                                "急單",
                                color = Color(0xFFB3261E),
                                style = MaterialTheme.typography.labelLarge,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.graphicsLayer { scaleX = urgentPulse; scaleY = urgentPulse },
                            )
                        }
                        Text(
                            order.shop.label,
                            fontWeight = FontWeight.Bold,
                            style = MaterialTheme.typography.titleMedium,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                        Text(
                            "交易編號 ${order.transactionCode ?: order.externalOrderId}",
                            color = Color(0xFF6C7F93),
                            style = MaterialTheme.typography.bodySmall,
                        )
                        Text(
                            "已派送 ${order.shop.totalSentOrders} 張單",
                            color = Color(0xFF2E4765),
                            style = MaterialTheme.typography.labelSmall,
                        )
                        Text(
                            "送達時間 ${order.deliveryDeadlineText}",
                            color = Color(0xFF6C7F93),
                            style = MaterialTheme.typography.bodySmall,
                        )
                        val publishedAtText = remember(order.publishedAt) {
                            order.publishedAt?.let { runCatching { DateTimeFormatter.ofPattern("MM/dd HH:mm").format(OffsetDateTime.parse(it)) }.getOrNull() }
                        }
                        Text(
                            "發單日期 ${publishedAtText ?: "-"}",
                            color = Color(0xFF6C7F93),
                            style = MaterialTheme.typography.bodySmall,
                        )
                    }
                    Surface(
                        shape = RoundedCornerShape(14.dp),
                        color = if (order.isUrgent) Color(0xFFFFE5E5) else Color(0xFFFFF2CB)
                    ) {
                        Text(
                            text = "MOP ${order.totalAmountMop}",
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                            color = if (order.isUrgent) Color(0xFFB3261E) else Color(0xFF8A5A00),
                            style = MaterialTheme.typography.labelLarge,
                            fontWeight = FontWeight.Bold,
                        )
                    }
                }

                Surface(
                    shape = RoundedCornerShape(14.dp),
                    color = Color(0xFFFFFBF1),
                    border = BorderStroke(1.dp, Color(0xFFF3E6CA))
                ) {
                    Column(
                        modifier = Modifier.padding(8.dp),
                        verticalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Text(
                            "商戶地址",
                            style = MaterialTheme.typography.labelLarge,
                            color = Color(0xFF2E4765),
                            fontWeight = FontWeight.SemiBold,
                        )
                        Text(order.shop.address, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Text(
                            "客戶地址",
                            style = MaterialTheme.typography.labelLarge,
                            color = Color(0xFF2E4765),
                            fontWeight = FontWeight.SemiBold,
                        )
                        Text(order.customer.address, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }

                Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                    PaymentTagChip(order.paymentTag)
                    Text(
                        "取貨區：${order.shop.district ?: "未分區"} · 送達區：${order.customer.district ?: "未分區"}",
                        style = MaterialTheme.typography.bodySmall,
                        color = Color(0xFF607286),
                    )
                }
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        "${distanceLabel(order)} · ${order.deliveryDeadlineText}",
                        style = MaterialTheme.typography.bodySmall,
                        color = Color(0xFF607286),
                    )
                }
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    OutlinedButton(
                        onClick = onNavigateToShop,
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(14.dp),
                        border = BorderStroke(1.dp, Color(0xFFF1D99A))
                    ) {
                        Icon(Icons.Default.Directions, contentDescription = null)
                        Spacer(modifier = Modifier.size(8.dp))
                        Text("前往商戶")
                    }
                    Button(
                        onClick = onAcceptOrder,
                        modifier = Modifier.weight(1f),
                        enabled = isOnline && !acceptActionLocked,
                        shape = RoundedCornerShape(14.dp),
                    ) {
                        if (isAccepting) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(18.dp),
                                strokeWidth = 2.dp,
                                color = Color.White,
                            )
                            Spacer(modifier = Modifier.size(8.dp))
                            Text("接單中...")
                        } else {
                            Text(if (isOnline) "接單" else "請先上線")
                        }
                    }
                }
                if (isAccepting) {
                    Text(
                        "正在為你接單，請稍候，馬上出發...",
                        color = Color(0xFF6C7F93),
                        style = MaterialTheme.typography.bodySmall,
                    )
                }
            }
        }
    }
}

@Composable
private fun ActiveOrderCard(
    displayLabel: String,
    order: Order,
    onNavigateToShop: () -> Unit,
    onCallShop: () -> Unit,
    onNavigateToCustomer: () -> Unit,
    onCallCustomer: () -> Unit,
    onMarkPickedUp: () -> Unit,
    onCompleteOrder: () -> Unit,
    onGraceCancel: () -> Unit,
    onConfirmCanceled: () -> Unit,
    onCancelOrder: () -> Unit,
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (order.status.isCanceledLike() && order.cancelHandling == com.membershipdeliverydriver.app.core.CancelHandling.NOT_RETURNING) Color(0xFFFFECEC) else Color.White
        ),
        border = BorderStroke(
            1.dp,
            if (order.status.isCanceledLike() && order.cancelHandling == com.membershipdeliverydriver.app.core.CancelHandling.NOT_RETURNING) Color(0xFFE58A8A) else Color(0xFFF0DFC0)
        )
    ) {
        Column(modifier = Modifier.padding(horizontal = 12.dp, vertical = 11.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(2.dp)
                ) {
                    if (order.isUrgent) {
                        Text(
                            "急單",
                            color = Color(0xFFB3261E),
                            style = MaterialTheme.typography.labelLarge,
                            fontWeight = FontWeight.Bold,
                        )
                    }
                    Text(displayLabel, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium)
                    Text(
                        "交易編號 ${order.transactionCode ?: order.externalOrderId}",
                        style = MaterialTheme.typography.bodySmall,
                        color = Color(0xFF6C7F93),
                    )
                    Text(
                        "${order.shop.label} · 已派送 ${order.shop.totalSentOrders} 張單",
                        style = MaterialTheme.typography.bodySmall,
                        color = Color(0xFF2E4765),
                    )
                    Text(
                        "送達時間 ${order.deliveryDeadlineText}",
                        style = MaterialTheme.typography.bodySmall,
                        color = Color(0xFF6C7F93),
                    )
                }
                Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    StatusBadge(label = orderStatusLabel(order.status), highlight = order.status != OrderStatus.ISSUE_REPORTED)
                    Text(
                        "MOP ${order.totalAmountMop}",
                        color = if (order.isUrgent) Color(0xFFB3261E) else Color(0xFF8A5A00),
                        fontWeight = FontWeight.Bold,
                        style = MaterialTheme.typography.titleMedium,
                    )
                    if (!order.pickedUpAt.isNullOrBlank()) {
                        PickupElapsedChip(startedAt = order.pickedUpAt)
                    }
                }
            }

            DeliveryStageStrip(status = order.status)

            Surface(
                shape = RoundedCornerShape(14.dp),
                color = Color(0xFFFFFBF1),
                border = BorderStroke(1.dp, Color(0xFFF3E6CA))
            ) {
                Column(
                    modifier = Modifier.padding(8.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    ContactLocationRow(
                        title = order.shop.label,
                        subtitle = order.shop.address,
                        onCall = onCallShop,
                        onNavigate = onNavigateToShop,
                    )
                    ContactLocationRow(
                        title = order.customer.label,
                        subtitle = order.customer.address,
                        onCall = onCallCustomer,
                        onNavigate = onNavigateToCustomer,
                    )
                }
            }

            Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                PaymentTagChip(order.paymentTag)
                Text(
                    "取貨區：${order.shop.district ?: "未分區"} · 送達區：${order.customer.district ?: "未分區"}",
                    style = MaterialTheme.typography.bodySmall,
                    color = Color(0xFF607286),
                )
            }
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(
                    "${distanceLabel(order)} · 請盡快完成本單",
                    color = Color(0xFF607286),
                    style = MaterialTheme.typography.bodySmall,
                )
            }
            if (order.status.isCanceledLike()) {
                Text(
                    when {
                        order.status.isDriverCanceled() -> "已由騎手取消，等待商戶確認。"
                        order.cancelHandling == com.membershipdeliverydriver.app.core.CancelHandling.RETURN_TO_SHOP -> "已由商戶取消配送。"
                        order.cancelHandling == com.membershipdeliverydriver.app.core.CancelHandling.NOT_RETURNING -> "已由商戶取消配送。"
                        else -> "訂單已被商戶取消。"
                    },
                    color = if (order.cancelHandling == com.membershipdeliverydriver.app.core.CancelHandling.NOT_RETURNING) Color(0xFFB3261E) else Color(0xFF8A5A00),
                    style = MaterialTheme.typography.bodyMedium,
                )

                if (order.status.isShopOwnerCanceled() || order.status == OrderStatus.CANCELED) {
                    Button(
                        onClick = onConfirmCanceled,
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(18.dp),
                    ) {
                        Text("確認已取消")
                    }
                }
            } else if (order.status == OrderStatus.HEADING_TO_SHOP || order.status == OrderStatus.ASSIGNED) {
                Button(
                    onClick = onMarkPickedUp,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(18.dp)
                ) {
                    Icon(Icons.Default.MoreTime, contentDescription = null)
                    Spacer(modifier = Modifier.size(8.dp))
                    Text("已取貨")
                }
            } else {
                Button(
                    onClick = onCompleteOrder,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(18.dp)
                ) {
                    Icon(Icons.Default.PhotoCamera, contentDescription = null)
                    Spacer(modifier = Modifier.size(8.dp))
                    Text("拍照後完成訂單")
                }
            }
            val graceSecondsLeft = rememberGraceCancelSecondsLeft(order.acceptedAt)
            if ((order.status == OrderStatus.HEADING_TO_SHOP || order.status == OrderStatus.ASSIGNED) && graceSecondsLeft > 0) {
                Surface(
                    shape = RoundedCornerShape(14.dp),
                    color = Color(0xFFFFEFEF),
                    border = BorderStroke(1.dp, Color(0xFFE6B7B7)),
                ) {
                    Text(
                        "可在 ${formatGraceCountdown(graceSecondsLeft)} 內取消並釋出回首頁",
                        modifier = Modifier.padding(horizontal = 14.dp, vertical = 12.dp),
                        color = Color(0xFFB3261E),
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.SemiBold,
                    )
                }
                Button(
                    onClick = onGraceCancel,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(14.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFD32F2F)),
                ) {
                    Text("立即取消並釋出")
                }
            } else {
                OutlinedButton(
                    onClick = onCancelOrder,
                    modifier = Modifier.fillMaxWidth(),
                    enabled = order.status != OrderStatus.DELIVERED,
                    shape = RoundedCornerShape(14.dp),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = Color(0xFFB3261E)),
                    border = BorderStroke(1.dp, Color(0xFFE58A8A))
                ) {
                    Text("取消訂單")
                }
            }
        }
    }
}

@Composable
private fun ContactLocationRow(
    title: String,
    subtitle: String,
    onCall: () -> Unit,
    onNavigate: () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                title,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.weight(1f),
            )
            IconButton(onClick = onCall) {
                Icon(Icons.Default.Call, contentDescription = "致電")
            }
        }
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.Top,
        ) {
            Text(
                subtitle,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.weight(1f),
            )
            IconButton(onClick = onNavigate) {
                Icon(Icons.Default.Place, contentDescription = "導航")
            }
        }
    }
}


@Composable
private fun DeliveryStageStrip(status: OrderStatus) {
    if (status.isCanceledLike()) {
        Surface(
            shape = RoundedCornerShape(14.dp),
            color = Color(0xFFFFEFEF),
            border = BorderStroke(1.dp, Color(0xFFE6B7B7))
        ) {
            Text(
                "此訂單已取消配送",
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 14.dp, vertical = 12.dp),
                color = Color(0xFFB3261E),
                style = MaterialTheme.typography.labelLarge,
                fontWeight = FontWeight.SemiBold,
            )
        }
        return
    }

    val stages = listOf(
        "前往商戶" to (status == OrderStatus.ASSIGNED || status == OrderStatus.HEADING_TO_SHOP || status == OrderStatus.PICKED_UP || status == OrderStatus.HEADING_TO_CUSTOMER || status == OrderStatus.DELIVERED),
        "已取貨" to (status == OrderStatus.PICKED_UP || status == OrderStatus.HEADING_TO_CUSTOMER || status == OrderStatus.DELIVERED),
        "前往客戶" to (status == OrderStatus.HEADING_TO_CUSTOMER || status == OrderStatus.DELIVERED)
    )
    val activeIndex = when (status) {
        OrderStatus.ASSIGNED, OrderStatus.HEADING_TO_SHOP -> 0
        OrderStatus.PICKED_UP -> 1
        OrderStatus.HEADING_TO_CUSTOMER, OrderStatus.DELIVERED -> 2
        else -> 0
    }
    val pulse by rememberInfiniteTransition(label = "stagePulse").animateFloat(
        initialValue = 0.9f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(850, easing = FastOutSlowInEasing), RepeatMode.Reverse),
        label = "stagePulseValue",
    )

    Surface(
        shape = RoundedCornerShape(14.dp),
        color = Color(0xFFFFF8E8),
        border = BorderStroke(1.dp, Color(0xFFF3E6CA))
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 8.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            stages.forEachIndexed { index, (label, done) ->
                val background by animateColorAsState(
                    targetValue = when {
                        done && index == activeIndex && status != OrderStatus.DELIVERED -> Color(0xFFFFD76A).copy(alpha = pulse)
                        done -> Color(0xFFFFD76A)
                        else -> Color.White
                    },
                    animationSpec = tween(350),
                    label = "stageColor$index",
                )
                val scale by animateFloatAsState(
                    targetValue = if (index == activeIndex && status != OrderStatus.DELIVERED) 1.02f else 1f,
                    animationSpec = tween(350),
                    label = "stageScale$index",
                )
                Surface(
                    modifier = Modifier.weight(1f).graphicsLayer { scaleX = scale; scaleY = scale },
                    shape = RoundedCornerShape(14.dp),
                    color = background
                ) {
                    Text(
                        text = label,
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 10.dp, vertical = 7.dp),
                        color = if (done) Color(0xFF6E4A00) else Color(0xFF8A97A6),
                        style = MaterialTheme.typography.labelMedium,
                        fontWeight = if (done) FontWeight.SemiBold else FontWeight.Normal,
                        textAlign = TextAlign.Center,
                    )
                }
            }
        }
    }
}

@Composable
private fun PickupElapsedChip(startedAt: String) {
    var elapsedLabel by remember(startedAt) { mutableStateOf(formatElapsedPickup(startedAt)) }

    LaunchedEffect(startedAt) {
        while (true) {
            elapsedLabel = formatElapsedPickup(startedAt)
            delay(1000)
        }
    }

    Surface(
        shape = RoundedCornerShape(14.dp),
        color = Color(0xFFFFF2CB),
        border = BorderStroke(1.dp, Color(0xFFF1D99A))
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                Icons.Default.MoreTime,
                contentDescription = null,
                modifier = Modifier.size(14.dp),
                tint = Color(0xFF8A5A00),
            )
            Text(
                elapsedLabel,
                color = Color(0xFF8A5A00),
                style = MaterialTheme.typography.labelMedium,
                fontWeight = FontWeight.SemiBold,
            )
        }
    }
}

private fun formatElapsedPickup(startedAt: String): String {
    return runCatching {
        val started = OffsetDateTime.parse(startedAt)
        val elapsed = Duration.between(started, OffsetDateTime.now()).coerceAtLeast(Duration.ZERO)
        val minutes = elapsed.toMinutes()
        val seconds = elapsed.minusMinutes(minutes).seconds
        "已取貨 ${minutes}m ${seconds}s"
    }.getOrDefault("已取貨")
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun OrderDetailScreen(
    order: Order?,
    onBack: () -> Unit,
    onProofSelected: (Uri) -> Unit,
    onReportIssue: (String) -> Unit,
) {
    val context = LocalContext.current
    var issueNote by rememberSaveable { mutableStateOf("") }
    val proofLauncher = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        if (uri != null) onProofSelected(uri)
    }

    Scaffold(
        containerColor = Color(0xFFFFF8EE),
        topBar = {
            CenterAlignedTopAppBar(
                title = { Text("訂單詳情") },
                navigationIcon = { TextButton(onClick = onBack) { Text("返回") } },
                colors = TopAppBarDefaults.centerAlignedTopAppBarColors(
                    containerColor = Color(0xFFFFF8EE)
                )
            )
        },
    ) { innerPadding ->
        if (order == null) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding),
                contentAlignment = Alignment.Center,
            ) {
                Text("尚未選擇訂單。")
            }
            return@Scaffold
        }

        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .background(Color(0xFFFFF8EE))
                .padding(innerPadding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            item {
                Text("訂單 #${order.id}", style = MaterialTheme.typography.headlineSmall)
                Text(
                    "客戶備註：${order.customerNote}",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            item {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    StatusBadge(label = orderStatusLabel(order.status), highlight = true)
                    StatusBadge(label = "MOP ${order.totalAmountMop}", highlight = false)
                }
            }
            item {
                LocationCard(
                    title = "商戶取貨點",
                    locationLabel = order.shop.label,
                    address = order.shop.address,
                    contactName = order.shop.contactName,
                    contactPhone = order.shop.contactPhone,
                    onCall = { openDialer(context, order.shop.contactPhone) },
                    onNavigate = { openNavigation(context, order.shop) },
                )
            }
            item {
                LocationCard(
                    title = "客戶送達點",
                    locationLabel = order.customer.label,
                    address = order.customer.address,
                    contactName = order.customer.contactName,
                    contactPhone = order.customer.contactPhone,
                    onCall = { openDialer(context, order.customer.contactPhone) },
                    onNavigate = { openNavigation(context, order.customer) },
                )
            }
            item {
                Card(
                    shape = RoundedCornerShape(24.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    border = BorderStroke(1.dp, Color(0xFFF0DFC0))
                ) {
                    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("商品清單", fontWeight = FontWeight.SemiBold)
                        order.items.forEach { item ->
                            Text("• ${item.quantity} × ${item.name}")
                        }
                    }
                }
            }
            item {
                Card(
                    shape = RoundedCornerShape(24.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    border = BorderStroke(1.dp, Color(0xFFF0DFC0))
                ) {
                    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("送達證明", fontWeight = FontWeight.SemiBold)
                        Text(
                            order.proofOfDeliveryUri?.toString() ?: "請上傳送達照片，作為已完成配送的證明。",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        OutlinedButton(
                            onClick = { proofLauncher.launch("image/*") },
                            shape = RoundedCornerShape(14.dp),
                            border = BorderStroke(1.dp, Color(0xFFF1D99A))
                        ) {
                            Icon(Icons.Default.CameraAlt, contentDescription = null)
                            Spacer(modifier = Modifier.size(8.dp))
                            Text(if (order.proofOfDeliveryUri == null) "上傳送達照片" else "重新上傳照片")
                        }
                    }
                }
            }
            item {
                Card(
                    shape = RoundedCornerShape(24.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    border = BorderStroke(1.dp, Color(0xFFF0DFC0))
                ) {
                    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("異常回報", fontWeight = FontWeight.SemiBold)
                        OutlinedTextField(
                            value = issueNote,
                            onValueChange = { issueNote = it },
                            label = { Text("異常說明") },
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(14.dp),
                        )
                        Button(
                            onClick = { onReportIssue(issueNote) },
                            shape = RoundedCornerShape(18.dp)
                        ) {
                            Icon(Icons.Default.ReportProblem, contentDescription = null)
                            Spacer(modifier = Modifier.size(8.dp))
                            Text("提交異常")
                        }
                        if (order.issueNote.isNotBlank()) {
                            Text(
                                "最近一次異常：${order.issueNote}",
                                color = MaterialTheme.colorScheme.error,
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun LocationCard(
    title: String,
    locationLabel: String,
    address: String,
    contactName: String,
    contactPhone: String,
    onCall: () -> Unit,
    onNavigate: () -> Unit,
) {
    Card(
        shape = RoundedCornerShape(24.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        border = BorderStroke(1.dp, Color(0xFFF0DFC0))
    ) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(title, fontWeight = FontWeight.SemiBold)
            Text(locationLabel, style = MaterialTheme.typography.titleMedium)
            Text(address, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text("聯絡人：$contactName · $contactPhone", style = MaterialTheme.typography.bodySmall)
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                OutlinedButton(
                    onClick = onNavigate,
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(14.dp),
                    border = BorderStroke(1.dp, Color(0xFFF1D99A))
                ) {
                    Icon(Icons.Default.Directions, contentDescription = null)
                    Spacer(modifier = Modifier.size(8.dp))
                    Text("導航")
                }
                OutlinedButton(
                    onClick = onCall,
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(14.dp),
                    border = BorderStroke(1.dp, Color(0xFFF1D99A))
                ) {
                    Icon(Icons.Default.Call, contentDescription = null)
                    Spacer(modifier = Modifier.size(8.dp))
                    Text("致電")
                }
            }
        }
    }
}

@Composable
private fun CompletedOrdersScreen(
    uiState: com.membershipdeliverydriver.app.core.DriverAppState,
    onFilterSelected: (com.membershipdeliverydriver.app.core.HistoryRange) -> Unit,
    onLoadMore: () -> Unit,
    onViewProof: (String) -> Unit,
    onCloseProof: () -> Unit,
) {
    val context = LocalContext.current
    val formatter = remember { DateTimeFormatter.ofPattern("MM/dd HH:mm") }
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .safeDrawingPadding()
            .background(Color(0xFFFFF8EE)),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text("已完成訂單", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                    Text("可查看送達時間、照片資訊與已完成紀錄。", color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                Surface(
                    shape = RoundedCornerShape(999.dp),
                    color = Color(0xFFFFE9A6),
                    border = BorderStroke(1.dp, Color(0xFFF6D56A))
                ) {
                    Text(
                        text = "${uiState.completedOrders.size} 筆",
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 7.dp),
                        color = Color(0xFF6E4A00),
                        style = MaterialTheme.typography.labelLarge,
                        fontWeight = FontWeight.SemiBold,
                    )
                }
            }
        }
        item {
            HistoryRangeChips(
                selected = uiState.completedOrdersFilter,
                onSelected = onFilterSelected,
            )
        }
        if (uiState.completedOrders.isEmpty() && !uiState.isLoadingCompletedOrders) {
            item {
                FriendlyEmptyState(
                    title = "這個時間範圍內還沒有已完成訂單",
                    subtitle = "完成第一張單之後，這裡會出現你的成果與送達紀錄。",
                )
            }
        }
        items(uiState.completedOrders.size, key = { index -> uiState.completedOrders[index].id }) { index ->
            val order = uiState.completedOrders[index]
            Card(
                shape = RoundedCornerShape(24.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                border = BorderStroke(1.dp, Color(0xFFF0DFC0))
            ) {
                Column(modifier = Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                            Text("訂單 ${index + 1}", fontWeight = FontWeight.SemiBold)
                            Text(
                                "交易編號 ${order.transactionCode ?: order.externalOrderId}",
                                style = MaterialTheme.typography.bodySmall,
                                color = Color(0xFF6C7F93),
                            )
                            Text(
                                "${order.shop.label} → ${order.customer.label}",
                                style = MaterialTheme.typography.bodySmall,
                                color = Color(0xFF2E4765),
                            )
                            Text(
                                "取貨時間：${order.pickedUpAt?.let { formatter.format(OffsetDateTime.parse(it)) } ?: "待同步"}",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                            Text(
                                "完成時間：${order.deliveredAt?.let { formatter.format(OffsetDateTime.parse(it)) } ?: "待同步"}",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                        Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Surface(
                                shape = RoundedCornerShape(16.dp),
                                color = if (order.status.isCanceledLike()) Color(0xFFFFE5E5) else Color(0xFFFFF2CB)
                            ) {
                                Text(
                                    if (order.status.isCanceledLike()) "已取消" else "MOP ${order.totalAmountMop}",
                                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                                    style = MaterialTheme.typography.titleMedium,
                                    color = if (order.status.isCanceledLike()) Color(0xFFB3261E) else Color(0xFF8A5A00),
                                    fontWeight = FontWeight.Bold,
                                )
                            }
                            if (order.status.isCanceledLike()) {
                                Text(
                                    "MOP 0",
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = Color(0xFFB3261E),
                                    fontWeight = FontWeight.SemiBold,
                                )
                            }
                        }
                    }
                    Text("客戶地址：${order.customer.address}", color = MaterialTheme.colorScheme.onSurfaceVariant)
                    if (order.status.isCanceledLike()) {
                        Text(
                            "取消原因：${order.cancelReason ?: "未提供"}${order.cancelOtherReason?.takeIf { it.isNotBlank() }?.let { " / $it" } ?: ""}",
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    } else {
                        Text(
                            if (!order.proofOfDeliveryPath.isNullOrBlank()) "送達照片：已上傳" else "送達照片：未同步",
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    if (!order.status.isCanceledLike() && !order.proofOfDeliveryPath.isNullOrBlank()) {
                        OutlinedButton(
                            onClick = { onViewProof(order.id) },
                            shape = RoundedCornerShape(16.dp),
                        ) {
                            Text("查看送達照片")
                        }
                    }
                }
            }
        }
        if (uiState.completedOrdersHasMore) {
            item {
                OutlinedButton(
                    onClick = onLoadMore,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(14.dp),
                ) {
                    Text(if (uiState.isLoadingCompletedOrders) "載入中..." else "載入更多")
                }
            }
        }
    }

    if (uiState.proofViewerOrderId != null) {
        val bitmap = remember(uiState.proofViewerBytes) {
            uiState.proofViewerBytes?.let {
                runCatching { android.graphics.BitmapFactory.decodeByteArray(it, 0, it.size) }.getOrNull()
            }
        }
        AlertDialog(
            onDismissRequest = onCloseProof,
            title = { Text("送達照片") },
            text = {
                when {
                    uiState.proofViewerLoading -> Text("正在載入照片…")
                    bitmap != null -> Image(
                        bitmap = bitmap.asImageBitmap(),
                        contentDescription = null,
                        modifier = Modifier
                            .fillMaxWidth()
                            .heightIn(min = 220.dp, max = 420.dp)
                    )
                    else -> Text("無法載入照片。")
                }
            },
            confirmButton = { TextButton(onClick = onCloseProof) { Text("關閉") } }
        )
    }
}

@Composable
private fun HistoryChoiceChips(
    options: List<String>,
    selected: String,
    onSelected: (String) -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        options.forEach { option ->
            FilterChip(
                selected = selected == option,
                onClick = { onSelected(option) },
                label = { Text(option) },
            )
        }
    }
}

@Composable
private fun rememberGraceCancelSecondsLeft(startedAt: String?, limitSeconds: Int = 30): Int {
    if (startedAt.isNullOrBlank()) return 0
    var secondsLeft by remember(startedAt) { mutableStateOf(computeGraceCancelSecondsLeft(startedAt, limitSeconds)) }
    LaunchedEffect(startedAt) {
        while (true) {
            secondsLeft = computeGraceCancelSecondsLeft(startedAt, limitSeconds)
            delay(1000)
        }
    }
    return secondsLeft
}

private fun computeGraceCancelSecondsLeft(startedAt: String, limitSeconds: Int): Int {
    return runCatching {
        val started = OffsetDateTime.parse(startedAt)
        val elapsed = Duration.between(started, OffsetDateTime.now()).coerceAtLeast(Duration.ZERO).seconds.toInt()
        (limitSeconds - elapsed).coerceAtLeast(0)
    }.getOrDefault(0)
}

private fun formatGraceCountdown(secondsLeft: Int): String {
    val minutes = secondsLeft / 60
    val seconds = secondsLeft % 60
    return "%d:%02d".format(minutes, seconds)
}

@OptIn(ExperimentalMaterialApi::class)
@Composable
private fun LeaderboardScreen(
    uiState: com.membershipdeliverydriver.app.core.DriverAppState,
    onBack: () -> Unit,
    onRefresh: () -> Unit,
) {
    val pullRefreshState = rememberPullRefreshState(
        refreshing = uiState.isLoadingWeeklyLeaderboard,
        onRefresh = onRefresh,
    )

    LaunchedEffect(Unit) {
        if (uiState.weeklyLeaderboard == null) {
            onRefresh()
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFFFF8EE))
            .pullRefresh(pullRefreshState)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .safeDrawingPadding()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = null)
                    }
                    Text("車手排名", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                }
                TextButton(onClick = onRefresh) { Text("刷新") }
            }

            uiState.weeklyLeaderboard?.let { lb ->
                Surface(
                    shape = RoundedCornerShape(18.dp),
                    color = Color.White,
                    border = BorderStroke(1.dp, Color(0xFFF0DFC0))
                ) {
                    Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("本週完成單數", fontWeight = FontWeight.SemiBold, color = Color(0xFF2E4765))
                        LeaderboardRow(title = "我的名次", entry = lb.me, highlight = true)
                    }
                }

                Surface(
                    shape = RoundedCornerShape(18.dp),
                    color = Color.White,
                    border = BorderStroke(1.dp, Color(0xFFF0DFC0))
                ) {
                    Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Text("排行榜（前 20）", fontWeight = FontWeight.SemiBold, color = Color(0xFF2E4765))
                        if (lb.top.isEmpty()) {
                            Text("本週暫時沒有完成紀錄。", color = Color(0xFF6C7F93), style = MaterialTheme.typography.bodySmall)
                        } else {
                            lb.top.forEach { entry ->
                                LeaderboardRow(title = null, entry = entry, highlight = entry.name == lb.me.name)
                            }
                        }
                        Text(
                            "提示：排名每次刷新會重新計算。",
                            color = Color(0xFF6C7F93),
                            style = MaterialTheme.typography.bodySmall,
                        )
                    }
                }
            } ?: run {
                FriendlyEmptyState(
                    title = "暫時未有排名資料",
                    subtitle = "下拉或按刷新以載入本週完成單數排名。",
                )
            }
        }

        CuteDriverPullRefreshIndicator(
            refreshing = uiState.isLoadingWeeklyLeaderboard,
            progress = pullRefreshState.progress,
            modifier = Modifier.align(Alignment.TopCenter),
        )
    }
}

@Composable
private fun LeaderboardRow(
    title: String?,
    entry: LeaderboardEntry,
    highlight: Boolean,
) {
    val bg = if (highlight) Color(0xFFFFF2CB) else Color.Transparent
    Surface(shape = RoundedCornerShape(12.dp), color = bg) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 10.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                if (title != null) {
                    Text(title, color = Color(0xFF6C7F93), style = MaterialTheme.typography.bodySmall)
                }
                Surface(
                    shape = RoundedCornerShape(999.dp),
                    color = Color(0xFFFFE9A6),
                    border = BorderStroke(1.dp, Color(0xFFF6D56A))
                ) {
                    Text(
                        text = entry.rank?.let { "#${it}" } ?: "-",
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
                        color = Color(0xFF6E4A00),
                        style = MaterialTheme.typography.labelLarge,
                        fontWeight = FontWeight.SemiBold,
                    )
                }
                Text(entry.name, fontWeight = FontWeight.SemiBold, color = Color(0xFF2E4765))
            }
            Text(
                "${entry.completedCount} 單",
                fontWeight = FontWeight.Bold,
                color = Color(0xFF8A5A00),
            )
        }
    }
}

@Composable
private fun ProfileScreen(
    uiState: com.membershipdeliverydriver.app.core.DriverAppState,
    onEarningsFilterSelected: (com.membershipdeliverydriver.app.core.HistoryRange) -> Unit,
    onCheckForUpdates: () -> Unit,
    onRefreshAnnouncements: () -> Unit,
    onOpenLeaderboard: () -> Unit,
    onChangePin: (String, () -> Unit) -> Unit,
    onLogout: () -> Unit,
) {
    val context = LocalContext.current
    val driver = uiState.currentDriver
    val formatter = remember { DateTimeFormatter.ofPattern("MM/dd HH:mm") }
    val filteredEarnings = uiState.earnings.filter { entry ->
        matchesHistoryRange(entry.completedAt.toLocalDate(), uiState.earningsFilter)
    }
    val filteredTotal = filteredEarnings.sumOf { it.amountMop }

    var showChangePin by remember { mutableStateOf(false) }
    var newPin by remember { mutableStateOf("") }
    var confirmPin by remember { mutableStateOf("") }
    var localPinError by remember { mutableStateOf<String?>(null) }

    if (showChangePin) {
        AlertDialog(
            onDismissRequest = { showChangePin = false },
            title = { Text("更改密碼") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlinedTextField(
                        value = newPin,
                        onValueChange = {
                            newPin = it.filter(Char::isDigit).take(4)
                            localPinError = null
                        },
                        label = { Text("新密碼（4 位數字）") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                        visualTransformation = PasswordVisualTransformation(),
                        singleLine = true,
                    )
                    OutlinedTextField(
                        value = confirmPin,
                        onValueChange = {
                            confirmPin = it.filter(Char::isDigit).take(4)
                            localPinError = null
                        },
                        label = { Text("再次輸入") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                        visualTransformation = PasswordVisualTransformation(),
                        singleLine = true,
                    )
                    localPinError?.let { msg ->
                        Text(msg, color = Color(0xFFB3261E), style = MaterialTheme.typography.bodySmall)
                    }
                }
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        when {
                            newPin.length != 4 -> localPinError = "新密碼必須為 4 位數字。"
                            confirmPin.length != 4 -> localPinError = "請再次輸入 4 位數字密碼。"
                            newPin != confirmPin -> localPinError = "兩次輸入的密碼不一致。"
                            else -> onChangePin(newPin) {
                                newPin = ""
                                confirmPin = ""
                                localPinError = null
                                showChangePin = false
                            }
                        }
                    }
                ) {
                    Text("確定")
                }
            },
            dismissButton = {
                TextButton(
                    onClick = {
                        showChangePin = false
                        newPin = ""
                        confirmPin = ""
                        localPinError = null
                    }
                ) {
                    Text("取消")
                }
            }
        )
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .safeDrawingPadding()
            .background(Color(0xFFFFF8EE)),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        item {
            Text("我的資料", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
        }
        item {
            Card(
                shape = RoundedCornerShape(14.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                border = BorderStroke(1.dp, Color(0xFFF0DFC0))
            ) {
                Column(modifier = Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(driver?.fullName ?: "未登入", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
                    Text("電話：${driver?.phone ?: "-"}", color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text("版本：${com.membershipdeliverydriver.app.BuildConfig.VERSION_NAME}", color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text("若未收到更新推送，可手動檢查更新。", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        OutlinedButton(onClick = onCheckForUpdates, modifier = Modifier.weight(1f), shape = RoundedCornerShape(14.dp)) {
                            Text("檢查更新")
                        }
                        OutlinedButton(onClick = onRefreshAnnouncements, modifier = Modifier.weight(1f), shape = RoundedCornerShape(14.dp)) {
                            Text("刷新公告")
                        }
                    }
                    
                    OutlinedButton(
                        onClick = {
                            val fallback = com.membershipdeliverydriver.app.BuildConfig.API_BASE_URL.trimEnd('/') + "/apkdownload/latest"
                            val url = uiState.updateInfo?.stableDownloadUrl
                                ?.takeIf { it.isNotBlank() }
                                ?: uiState.updateInfo?.downloadPageUrl
                                    ?.takeIf { it.isNotBlank() }
                                ?: fallback
                            openExternalUrl(context, url)
                        },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(14.dp)
                    ) {
                        Text("手動下載新版本")
                    }

                    OutlinedButton(
                        onClick = onOpenLeaderboard,
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(14.dp)
                    ) {
                        Text("車手排名")
                    }
                    OutlinedButton(
                        onClick = { showChangePin = true },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(14.dp)
                    ) {
                        Text("更改密碼")
                    }
                    StatusBadge(
                        label = "審核狀態：${approvalLabel(driver?.approvalStatus ?: ApprovalStatus.PENDING_APPROVAL)}",
                        highlight = driver?.approvalStatus == ApprovalStatus.APPROVED,
                    )
                }
            }
        }
        item {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("車手公告", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
                if (uiState.announcements.isEmpty()) {
                    Card(
                        shape = RoundedCornerShape(24.dp),
                        colors = CardDefaults.cardColors(containerColor = Color.White),
                        border = BorderStroke(1.dp, Color(0xFFF1E0BE))
                    ) {
                        Text(
                            "暫時沒有公告。",
                            modifier = Modifier.padding(18.dp),
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                } else {
                    uiState.announcements.forEach { ann ->
                        Card(
                            shape = RoundedCornerShape(24.dp),
                            colors = CardDefaults.cardColors(containerColor = Color.White),
                            border = BorderStroke(1.dp, Color(0xFFF0DFC0))
                        ) {
                            Column(modifier = Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                Text(ann.title, fontWeight = FontWeight.SemiBold)
                                Text(ann.content, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                Text(
                                    formatter.format(OffsetDateTime.parse(ann.createdAt)),
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                        }
                    }
                }
            }
        }
        item {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("收入紀錄", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
                HistoryRangeChips(
                    selected = uiState.earningsFilter,
                    onSelected = onEarningsFilterSelected,
                )
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    SummaryCard(title = "範圍收入", value = "MOP $filteredTotal", modifier = Modifier.weight(1f))
                    SummaryCard(title = "筆數", value = "${filteredEarnings.size}", modifier = Modifier.weight(1f))
                }
            }
        }
        if (filteredEarnings.isEmpty()) {
            item {
                Card(
                    shape = RoundedCornerShape(24.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    border = BorderStroke(1.dp, Color(0xFFF1E0BE))
                ) {
                    Text(
                        "這個時間範圍內還沒有收入紀錄。",
                        modifier = Modifier.padding(18.dp),
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
        items(filteredEarnings, key = { it.id }) { item ->
            Card(
                shape = RoundedCornerShape(24.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                border = BorderStroke(1.dp, Color(0xFFF0DFC0))
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(18.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(item.title, fontWeight = FontWeight.SemiBold)
                        Text(
                            formatter.format(item.completedAt),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    Surface(
                        shape = RoundedCornerShape(16.dp),
                        color = Color(0xFFFFF2CB)
                    ) {
                        Text(
                            "MOP ${item.amountMop}",
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                            style = MaterialTheme.typography.titleMedium,
                            color = Color(0xFF8A5A00),
                            fontWeight = FontWeight.Bold,
                        )
                    }
                }
            }
        }
        item {
            Button(
                onClick = onLogout,
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(18.dp)
            ) {
                Text("登出")
            }
        }
    }
}

@Composable
private fun HistoryRangeChips(
    selected: com.membershipdeliverydriver.app.core.HistoryRange,
    onSelected: (com.membershipdeliverydriver.app.core.HistoryRange) -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        listOf(
            com.membershipdeliverydriver.app.core.HistoryRange.TODAY,
            com.membershipdeliverydriver.app.core.HistoryRange.YESTERDAY,
            com.membershipdeliverydriver.app.core.HistoryRange.THIS_WEEK,
            com.membershipdeliverydriver.app.core.HistoryRange.THIS_MONTH,
            com.membershipdeliverydriver.app.core.HistoryRange.ALL,
        ).forEach { range ->
            FilterChip(
                selected = selected == range,
                onClick = { onSelected(range) },
                label = { Text(historyRangeLabel(range)) },
            )
        }
    }
}




@Composable
private fun CuteDriverPullRefreshIndicator(
    refreshing: Boolean,
    progress: Float,
    modifier: Modifier = Modifier,
) {
    val clamped = progress.coerceIn(0f, 1.4f)
    AnimatedVisibility(
        visible = refreshing || clamped > 0.02f,
        enter = fadeIn(tween(180)) + slideInVertically(initialOffsetY = { -it / 2 }),
        exit = fadeOut(tween(180)) + slideOutVertically(targetOffsetY = { -it / 2 }),
        modifier = modifier.padding(top = 10.dp)
    ) {
        Surface(
            shape = RoundedCornerShape(20.dp),
            color = Color.White.copy(alpha = 0.96f),
            border = BorderStroke(1.dp, Color(0xFFF0DFC0))
        ) {
            Column(
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 10.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                coil.compose.AsyncImage(
                    model = R.drawable.refresh_driver_pull,
                    contentDescription = null,
                    modifier = Modifier
                        .size(width = 124.dp, height = 56.dp)
                        .graphicsLayer {
                            alpha = 0.55f + (clamped.coerceAtMost(1f) * 0.45f)
                        },
                )
                Text(
                    if (refreshing) "Driver is riding over..." else "Pull to send the rider out",
                    style = MaterialTheme.typography.bodySmall,
                    color = Color(0xFF6C7F93),
                )
            }
        }
    }
}

@Composable
private fun FriendlyEmptyState(title: String, subtitle: String) {
    Card(
        shape = RoundedCornerShape(24.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        border = BorderStroke(1.dp, Color(0xFFF1E0BE))
    ) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 18.dp, vertical = 16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            CuteDriverPullRefreshIndicator(refreshing = true, progress = 1f)
            Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold, textAlign = TextAlign.Center)
            Text(subtitle, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium, textAlign = TextAlign.Center)
        }
    }
}

@Composable
private fun CompletionRewardBanner(amountMop: Double) {
    val sparkle by rememberInfiniteTransition(label = "rewardSparkle").animateFloat(
        initialValue = 0.94f,
        targetValue = 1.04f,
        animationSpec = infiniteRepeatable(tween(500, easing = FastOutSlowInEasing), RepeatMode.Reverse),
        label = "rewardScale",
    )
    Surface(
        shape = RoundedCornerShape(18.dp),
        color = Color(0xFFFFF2CB),
        border = BorderStroke(1.dp, Color(0xFFF3D26B)),
        modifier = Modifier.graphicsLayer { scaleX = sparkle; scaleY = sparkle }
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 10.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("🎉", style = MaterialTheme.typography.titleLarge)
            Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text("Delivery completed", fontWeight = FontWeight.Bold, color = Color(0xFF6E4A00))
                Text("+ MOP ${String.format("%.0f", amountMop)}", color = Color(0xFF8A5A00), style = MaterialTheme.typography.bodyMedium)
            }
        }
    }
}

@Composable
private fun SummaryCard(
    title: String,
    value: String,
    modifier: Modifier = Modifier,
) {
    Card(
        modifier = modifier.animateContentSize(),
        shape = RoundedCornerShape(24.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        border = BorderStroke(1.dp, Color(0xFFF0DFC0))
    ) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(title, color = MaterialTheme.colorScheme.onSurfaceVariant)
            AnimatedSummaryValue(value)
        }
    }
}

@Composable
private fun AnimatedSummaryValue(value: String) {
    val mopMatch = Regex("""^MOP\s+([0-9]+(?:\.[0-9]+)?)$""").matchEntire(value)
    val numberMatch = Regex("""^[0-9]+(?:\.[0-9]+)?$""").matchEntire(value)
    when {
        mopMatch != null -> {
            val target = mopMatch.groupValues[1].toFloatOrNull() ?: 0f
            val animated by animateFloatAsState(targetValue = target, animationSpec = tween(900, easing = FastOutSlowInEasing), label = "summaryMop")
            Text("MOP ${String.format("%.0f", animated)}", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
        }
        numberMatch != null -> {
            val target = numberMatch.groupValues[0].toFloatOrNull() ?: 0f
            val animated by animateFloatAsState(targetValue = target, animationSpec = tween(850, easing = FastOutSlowInEasing), label = "summaryNumber")
            Text(String.format("%.0f", animated), style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
        }
        else -> Text(value, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
    }
}

private fun approvalLabel(status: ApprovalStatus): String {
    return when (status) {
        ApprovalStatus.PENDING_APPROVAL -> "待審核"
        ApprovalStatus.APPROVED -> "已核准"
        ApprovalStatus.REJECTED -> "已拒絕"
    }
}

private fun availabilityLabel(status: DriverAvailability): String {
    return when (status) {
        DriverAvailability.ONLINE -> "在線"
        DriverAvailability.OFFLINE -> "離線"
    }
}

private fun orderStatusLabel(status: OrderStatus): String {
    return when (status) {
        OrderStatus.NEW -> "新單"
        OrderStatus.NEW_URGENT -> "急單"
        OrderStatus.ASSIGNED -> "已指派"
        OrderStatus.HEADING_TO_SHOP -> "前往商戶"
        OrderStatus.PICKED_UP -> "已取貨"
        OrderStatus.HEADING_TO_CUSTOMER -> "前往客戶"
        OrderStatus.DELIVERED -> "已送達"
        OrderStatus.CANCELED -> "已取消"
        OrderStatus.CANCELED_BY_DRIVER -> "騎手取消"
        OrderStatus.CANCELED_BY_SHOP_OWNER -> "商戶取消"
        OrderStatus.ISSUE_REPORTED -> "異常回報"
    }
}

@Composable
private fun StatusBadge(
    label: String,
    highlight: Boolean,
) {
    FilterChip(
        selected = highlight,
        onClick = {},
        label = { Text(label) },
    )
}

private fun openDialer(context: android.content.Context, phoneNumber: String) {
    val intent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:$phoneNumber"))
    context.startActivity(intent)
}



private data class MapNavigationOption(
    val label: String,
    val intent: Intent,
)

private fun openNavigation(
    context: android.content.Context,
    point: com.membershipdeliverydriver.app.core.LocationPoint,
) {
    val packageManager = context.packageManager
    val safeLabel = if (point.label.isBlank()) "目的地" else point.label
    val safeAddress = point.address.ifBlank { safeLabel }
    val encodedLabel = Uri.encode(safeLabel)
    val encodedAddress = Uri.encode(safeAddress)

    val wgs = point.navigationCoords?.wgs84
        ?: com.membershipdeliverydriver.app.core.CoordinatePair(point.latitude, point.longitude)
    val gcj = point.navigationCoords?.gcj02 ?: wgs
    val bd = point.navigationCoords?.bd09 ?: gcj

    fun candidateIntent(uri: String, packageName: String? = null): Intent? {
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(uri)).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            if (!packageName.isNullOrBlank()) setPackage(packageName)
        }
        return if (intent.resolveActivity(packageManager) != null) intent else null
    }

    val options = buildList {
        candidateIntent(
            uri = "google.navigation:q=${wgs.latitude},${wgs.longitude}",
            packageName = "com.google.android.apps.maps",
        )?.let { add(MapNavigationOption("Google 地圖 (WGS84)", it)) }

        candidateIntent(
            uri = "androidamap://route?sourceApplication=membership-driver&dlat=${gcj.latitude}&dlon=${gcj.longitude}&dname=$encodedLabel&dev=0&t=0",
            packageName = "com.autonavi.minimap",
        )?.let { add(MapNavigationOption("高德地圖 (GCJ02)", it)) }

        candidateIntent(
            uri = "baidumap://map/direction?destination=name:$encodedLabel|latlng:${bd.latitude},${bd.longitude}&coord_type=bd09ll&mode=driving&src=membership-driver",
            packageName = "com.baidu.BaiduMap",
        )?.let { add(MapNavigationOption("百度地圖 (BD09)", it)) }

        candidateIntent(
            uri = "qqmap://map/routeplan?type=drive&tocoord=${gcj.latitude},${gcj.longitude}&to=$encodedLabel",
            packageName = "com.tencent.map",
        )?.let { add(MapNavigationOption("騰訊地圖 (GCJ02)", it)) }

        candidateIntent(
            uri = "petalmaps://navigation?daddr=${gcj.latitude},${gcj.longitude}&dname=$encodedLabel",
            packageName = "com.huawei.maps.app",
        )?.let { add(MapNavigationOption("Petal Maps (GCJ02)", it)) }
    }

    if (options.isNotEmpty()) {
        val labels = options.map { it.label }.toTypedArray()
        android.app.AlertDialog.Builder(context)
            .setTitle("選擇導航地圖")
            .setMessage("系統會按你選擇的地圖，自動使用對應座標系導航。")
            .setItems(labels) { _, which ->
                runCatching { context.startActivity(options[which].intent) }
            }
            .setNegativeButton("取消", null)
            .show()
        return
    }

    val fallbackIntent = Intent(
        Intent.ACTION_VIEW,
        Uri.parse("geo:0,0?q=${wgs.latitude},${wgs.longitude}($encodedAddress)"),
    ).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }
    runCatching { context.startActivity(fallbackIntent) }
}

private fun openExternalUrl(context: android.content.Context, url: String) {
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }
    runCatching { context.startActivity(intent) }
}

private fun historyRangeLabel(range: com.membershipdeliverydriver.app.core.HistoryRange): String {
    return when (range) {
        com.membershipdeliverydriver.app.core.HistoryRange.TODAY -> "今日"
        com.membershipdeliverydriver.app.core.HistoryRange.YESTERDAY -> "昨天"
        com.membershipdeliverydriver.app.core.HistoryRange.THIS_WEEK -> "本週"
        com.membershipdeliverydriver.app.core.HistoryRange.THIS_MONTH -> "本月"
        com.membershipdeliverydriver.app.core.HistoryRange.ALL -> "全部"
    }
}

private fun matchesHistoryRange(
    date: java.time.LocalDate,
    range: com.membershipdeliverydriver.app.core.HistoryRange,
): Boolean {
    val today = java.time.LocalDate.now()
    return when (range) {
        com.membershipdeliverydriver.app.core.HistoryRange.TODAY -> date == today
        com.membershipdeliverydriver.app.core.HistoryRange.YESTERDAY -> date == today.minusDays(1)
        com.membershipdeliverydriver.app.core.HistoryRange.THIS_WEEK -> !date.isBefore(today.with(java.time.temporal.TemporalAdjusters.previousOrSame(java.time.DayOfWeek.MONDAY)))
        com.membershipdeliverydriver.app.core.HistoryRange.THIS_MONTH -> date.year == today.year && date.month == today.month
        com.membershipdeliverydriver.app.core.HistoryRange.ALL -> true
    }
}

private fun bitmapToCacheUri(context: android.content.Context, bitmap: Bitmap): Uri? {
    return runCatching {
        val file = java.io.File(context.cacheDir, "delivery-proof-${System.currentTimeMillis()}.jpg")
        file.outputStream().use { output ->
            bitmap.compress(Bitmap.CompressFormat.JPEG, 92, output)
        }
        Uri.fromFile(file)
    }.getOrNull()
}

private fun distanceLabel(order: Order): String {
    if (order.distanceKm <= 0) return "距離待更新"
    return when (order.status) {
        OrderStatus.PICKED_UP,
        OrderStatus.HEADING_TO_CUSTOMER -> "${order.distanceKm} 公里到客戶"
        else -> "${order.distanceKm} 公里到商戶"
    }
}
