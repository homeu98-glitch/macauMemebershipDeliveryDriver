package com.membershipdeliverydriver.app

import android.Manifest
import android.content.BroadcastReceiver
import android.content.Intent
import android.content.IntentFilter
import android.graphics.Bitmap
import android.net.Uri
import android.os.Build
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.clickable
import androidx.compose.foundation.Image
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.material.pullrefresh.PullRefreshIndicator
import androidx.compose.material.pullrefresh.pullRefresh
import androidx.compose.material.pullrefresh.rememberPullRefreshState
import androidx.compose.material.icons.Icons
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
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
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

    LaunchedEffect(uiState.currentDriver) {
        if (
            uiState.currentDriver != null &&
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

    DisposableEffect(uiState.currentDriver?.id, context) {
        if (uiState.currentDriver == null) {
            onDispose { }
        } else {
            val receiver = object : BroadcastReceiver() {
                override fun onReceive(context: android.content.Context?, intent: Intent?) {
                    if (intent?.action == com.membershipdeliverydriver.app.core.DriverFirebaseMessagingService.ACTION_ORDER_UPDATED) {
                        viewModel.onPushOrderUpdate()
                    }
                }
            }
            ContextCompat.registerReceiver(
                context,
                receiver,
                IntentFilter(com.membershipdeliverydriver.app.core.DriverFirebaseMessagingService.ACTION_ORDER_UPDATED),
                ContextCompat.RECEIVER_NOT_EXPORTED,
            )
            onDispose {
                runCatching { context.unregisterReceiver(receiver) }
            }
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
                    onLogout = viewModel::logout,
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
                    shape = RoundedCornerShape(18.dp),
                )
                OutlinedTextField(
                    value = password,
                    onValueChange = onPasswordChanged,
                    label = { Text("密碼") },
                    modifier = Modifier.fillMaxWidth(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                    visualTransformation = PasswordVisualTransformation(),
                    singleLine = true,
                    shape = RoundedCornerShape(18.dp),
                )
                Button(
                    onClick = onLogin,
                    modifier = Modifier.fillMaxWidth(),
                    enabled = !isLoading,
                    shape = RoundedCornerShape(18.dp),
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
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    OutlinedButton(
                        onClick = onRegister,
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(18.dp),
                        border = BorderStroke(1.dp, Color(0xFFF1D99A))
                    ) {
                        Text("立即註冊")
                    }
                    OutlinedButton(
                        onClick = onPendingApproval,
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(18.dp),
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
                shape = RoundedCornerShape(26.dp),
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
                        shape = RoundedCornerShape(18.dp),
                    )
                    OutlinedTextField(
                        value = registration.phone,
                        onValueChange = viewModel::updateRegistrationPhone,
                        label = { Text("電話號碼") },
                        modifier = Modifier.fillMaxWidth(),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                        singleLine = true,
                        shape = RoundedCornerShape(18.dp),
                    )
                    OutlinedTextField(
                        value = registration.password,
                        onValueChange = viewModel::updateRegistrationPassword,
                        label = { Text("密碼") },
                        modifier = Modifier.fillMaxWidth(),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                        visualTransformation = PasswordVisualTransformation(),
                        singleLine = true,
                        shape = RoundedCornerShape(18.dp),
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
                shape = RoundedCornerShape(18.dp),
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
                shape = RoundedCornerShape(18.dp),
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
) {
    val context = LocalContext.current
    val driver = uiState.currentDriver
    val pullRefreshState = rememberPullRefreshState(
        refreshing = uiState.isRefreshing,
        onRefresh = onRefresh,
    )

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
                                style = MaterialTheme.typography.titleLarge,
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
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text("可接訂單", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
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
                            text = "${uiState.availableOrders.size} 張",
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 7.dp),
                            color = Color(0xFF6E4A00),
                            style = MaterialTheme.typography.labelLarge,
                            fontWeight = FontWeight.SemiBold,
                        )
                    }
                }
            }
            if (uiState.availableOrders.isEmpty()) {
                item {
                    Card(
                        shape = RoundedCornerShape(24.dp),
                        colors = CardDefaults.cardColors(containerColor = Color.White),
                        border = BorderStroke(1.dp, Color(0xFFF1E0BE))
                    ) {
                        Column(
                            modifier = Modifier.padding(20.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Text(
                                "目前沒有可接訂單",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.SemiBold,
                            )
                            Text(
                                "保持上線並下拉刷新，新的配送票單會出現在這裡。",
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                style = MaterialTheme.typography.bodyMedium,
                            )
                        }
                    }
                }
            }
            items(uiState.availableOrders, key = { it.id }) { order ->
                AvailableOrderCard(
                    order = order,
                    isOnline = driver?.availability == DriverAvailability.ONLINE,
                    onNavigateToShop = {
                        openNavigation(context, order.shop.latitude, order.shop.longitude, order.shop.label)
                    },
                    onAcceptOrder = { onAcceptOrder(order.id) },
                )
            }
        }
        PullRefreshIndicator(
            refreshing = uiState.isRefreshing,
            state = pullRefreshState,
            modifier = Modifier.align(Alignment.TopCenter),
        )
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
    val activeOrders = orders.filterNot { it.status == OrderStatus.DELIVERED || (it.status == OrderStatus.CANCELED && !it.deliveredAt.isNullOrBlank()) }

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
                    Card(
                        shape = RoundedCornerShape(24.dp),
                        colors = CardDefaults.cardColors(containerColor = Color.White),
                        border = BorderStroke(1.dp, Color(0xFFF1E0BE))
                    ) {
                        Column(
                            modifier = Modifier.padding(20.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Text(
                                "目前沒有進行中的訂單",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.SemiBold,
                            )
                            Text(
                                "你接下的配送工單會在這裡集中顯示。",
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                }
            }
            items(activeOrders.size, key = { index -> activeOrders[index].id }) { index ->
                val order = activeOrders[index]
                ActiveOrderCard(
                    displayLabel = "訂單 ${index + 1}",
                    order = order,
                    onNavigateToShop = {
                        openNavigation(context, order.shop.latitude, order.shop.longitude, order.shop.label)
                    },
                    onCallShop = { openDialer(context, order.shop.contactPhone) },
                    onNavigateToCustomer = {
                        openNavigation(context, order.customer.latitude, order.customer.longitude, order.customer.label)
                    },
                    onCallCustomer = { openDialer(context, order.customer.contactPhone) },
                    onMarkPickedUp = { onMarkPickedUp(order.id) },
                    onCompleteOrder = {
                        completionOrderId = order.id
                    },
                    onGraceCancel = { onGraceCancel(order.id) },
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
        PullRefreshIndicator(
            refreshing = uiState.isRefreshing,
            state = pullRefreshState,
            modifier = Modifier.align(Alignment.TopCenter),
        )
    }
}

@Composable
private fun AvailableOrderCard(
    order: Order,
    isOnline: Boolean,
    onNavigateToShop: () -> Unit,
    onAcceptOrder: () -> Unit,
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(26.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        border = BorderStroke(1.dp, Color(0xFFF0DFC0))
    ) {
        Column(
            modifier = Modifier.padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    if (order.isUrgent) {
                        Text(
                            "URGENT",
                            color = Color(0xFFB3261E),
                            style = MaterialTheme.typography.labelLarge,
                            fontWeight = FontWeight.Bold,
                        )
                    }
                    Text(
                        order.shop.label,
                        fontWeight = FontWeight.Bold,
                        style = MaterialTheme.typography.titleLarge,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Text(
                        "送達時間 ${order.deliveryDeadlineText}",
                        color = Color(0xFF6C7F93),
                        style = MaterialTheme.typography.bodySmall,
                    )
                }
                Surface(
                    shape = RoundedCornerShape(18.dp),
                    color = if (order.isUrgent) Color(0xFFFFE5E5) else Color(0xFFFFF2CB)
                ) {
                    Text(
                        text = "MOP ${order.totalAmountMop}",
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                        color = if (order.isUrgent) Color(0xFFB3261E) else Color(0xFF8A5A00),
                        style = MaterialTheme.typography.labelLarge,
                        fontWeight = FontWeight.Bold,
                    )
                }
            }

            Surface(
                shape = RoundedCornerShape(20.dp),
                color = Color(0xFFFFFBF1),
                border = BorderStroke(1.dp, Color(0xFFF3E6CA))
            ) {
                Column(
                    modifier = Modifier.padding(14.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
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

            Text(
                "${distanceLabel(order)} · 請在 ${order.deliveryDeadlineText} 前完成送達",
                style = MaterialTheme.typography.bodyMedium,
                color = Color(0xFF607286),
            )
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                OutlinedButton(
                    onClick = onNavigateToShop,
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(18.dp),
                    border = BorderStroke(1.dp, Color(0xFFF1D99A))
                ) {
                    Icon(Icons.Default.Directions, contentDescription = null)
                    Spacer(modifier = Modifier.size(8.dp))
                    Text("前往商戶")
                }
                Button(
                    onClick = onAcceptOrder,
                    modifier = Modifier.weight(1f),
                    enabled = isOnline,
                    shape = RoundedCornerShape(18.dp),
                ) {
                    Text(if (isOnline) "接單" else "請先上線")
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
    onCancelOrder: () -> Unit,
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(26.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (order.status == OrderStatus.CANCELED && order.cancelHandling == com.membershipdeliverydriver.app.core.CancelHandling.NOT_RETURNING) Color(0xFFFFECEC) else Color.White
        ),
        border = BorderStroke(
            1.dp,
            if (order.status == OrderStatus.CANCELED && order.cancelHandling == com.membershipdeliverydriver.app.core.CancelHandling.NOT_RETURNING) Color(0xFFE58A8A) else Color(0xFFF0DFC0)
        )
    ) {
        Column(modifier = Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    if (order.isUrgent) {
                        Text(
                            "URGENT",
                            color = Color(0xFFB3261E),
                            style = MaterialTheme.typography.labelLarge,
                            fontWeight = FontWeight.Bold,
                        )
                    }
                    Text(displayLabel, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleLarge)
                    Text(
                        order.shop.label,
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
                shape = RoundedCornerShape(20.dp),
                color = Color(0xFFFFFBF1),
                border = BorderStroke(1.dp, Color(0xFFF3E6CA))
            ) {
                Column(
                    modifier = Modifier.padding(14.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
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

            Text(
                "${distanceLabel(order)} · 請盡快完成本單",
                color = Color(0xFF607286),
                style = MaterialTheme.typography.bodyMedium,
            )
            if (order.status == OrderStatus.CANCELED) {
                Text(
                    when (order.cancelHandling) {
                        com.membershipdeliverydriver.app.core.CancelHandling.RETURN_TO_SHOP -> "已取消配送，請把商品退回商戶。"
                        com.membershipdeliverydriver.app.core.CancelHandling.NOT_RETURNING -> "已取消配送且不退回，需由商戶端處理。"
                        null -> "已取消配送。"
                    },
                    color = if (order.cancelHandling == com.membershipdeliverydriver.app.core.CancelHandling.NOT_RETURNING) Color(0xFFB3261E) else Color(0xFF8A5A00),
                    style = MaterialTheme.typography.bodyMedium,
                )
                Text(
                    "訂單會在商戶確認取消後自動結束並移到已完成紀錄。",
                    color = Color(0xFF607286),
                    style = MaterialTheme.typography.bodySmall,
                )
                Button(
                    onClick = {
                        if (order.cancelHandling == com.membershipdeliverydriver.app.core.CancelHandling.RETURN_TO_SHOP) {
                            onNavigateToShop()
                        }
                    },
                    enabled = order.cancelHandling == com.membershipdeliverydriver.app.core.CancelHandling.RETURN_TO_SHOP,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(18.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (order.cancelHandling == com.membershipdeliverydriver.app.core.CancelHandling.NOT_RETURNING) Color(0xFFD32F2F) else MaterialTheme.colorScheme.primary
                    )
                ) {
                    Text(if (order.cancelHandling == com.membershipdeliverydriver.app.core.CancelHandling.RETURN_TO_SHOP) "導航退回商戶" else "等待商戶處理")
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
            val graceSecondsLeft = rememberGraceCancelSecondsLeft(order.pickedUpAt)
            if (order.status == OrderStatus.PICKED_UP && graceSecondsLeft > 0) {
                Surface(
                    shape = RoundedCornerShape(18.dp),
                    color = Color(0xFFFFEFEF),
                    border = BorderStroke(1.dp, Color(0xFFE6B7B7)),
                ) {
                    Text(
                        "可在 ${formatGraceCountdown(graceSecondsLeft)} 內取消並釋出回首頁（無需填寫原因）",
                        modifier = Modifier.padding(horizontal = 14.dp, vertical = 12.dp),
                        color = Color(0xFFB3261E),
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.SemiBold,
                    )
                }
                Button(
                    onClick = onGraceCancel,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(18.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFD32F2F)),
                ) {
                    Text("立即取消並釋出")
                }
            } else {
                OutlinedButton(
                    onClick = onCancelOrder,
                    modifier = Modifier.fillMaxWidth(),
                    enabled = order.status != OrderStatus.DELIVERED,
                    shape = RoundedCornerShape(18.dp),
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
    if (status == OrderStatus.CANCELED) {
        Surface(
            shape = RoundedCornerShape(18.dp),
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

    Surface(
        shape = RoundedCornerShape(18.dp),
        color = Color(0xFFFFF8E8),
        border = BorderStroke(1.dp, Color(0xFFF3E6CA))
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 10.dp, vertical = 10.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            stages.forEach { (label, done) ->
                Surface(
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(14.dp),
                    color = if (done) Color(0xFFFFD76A) else Color.White
                ) {
                    Text(
                        text = label,
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 8.dp),
                        color = if (done) Color(0xFF6E4A00) else Color(0xFF8A97A6),
                        style = MaterialTheme.typography.labelMedium,
                        fontWeight = if (done) FontWeight.SemiBold else FontWeight.Normal,
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
                    onNavigate = { openNavigation(context, order.shop.latitude, order.shop.longitude, order.shop.label) },
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
                    onNavigate = { openNavigation(context, order.customer.latitude, order.customer.longitude, order.customer.label) },
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
                            shape = RoundedCornerShape(18.dp),
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
                            shape = RoundedCornerShape(18.dp),
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
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                OutlinedButton(
                    onClick = onNavigate,
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(18.dp),
                    border = BorderStroke(1.dp, Color(0xFFF1D99A))
                ) {
                    Icon(Icons.Default.Directions, contentDescription = null)
                    Spacer(modifier = Modifier.size(8.dp))
                    Text("導航")
                }
                OutlinedButton(
                    onClick = onCall,
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(18.dp),
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
                Card(
                    shape = RoundedCornerShape(24.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    border = BorderStroke(1.dp, Color(0xFFF1E0BE))
                ) {
                    Text(
                        "這個時間範圍內還沒有已完成訂單。",
                        modifier = Modifier.padding(18.dp),
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
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
                        Column(modifier = Modifier.weight(1f)) {
                            Text("訂單 ${index + 1}", fontWeight = FontWeight.SemiBold)
                            Text(
                                "${order.shop.label} → ${order.customer.label}",
                                style = MaterialTheme.typography.bodySmall,
                                color = Color(0xFF2E4765),
                            )
                            Text(
                                order.deliveredAt?.let { formatter.format(OffsetDateTime.parse(it)) } ?: "完成時間待同步",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                        Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Surface(
                                shape = RoundedCornerShape(16.dp),
                                color = if (order.status == OrderStatus.CANCELED) Color(0xFFFFE5E5) else Color(0xFFFFF2CB)
                            ) {
                                Text(
                                    if (order.status == OrderStatus.CANCELED) "已取消" else "MOP ${order.totalAmountMop}",
                                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                                    style = MaterialTheme.typography.titleMedium,
                                    color = if (order.status == OrderStatus.CANCELED) Color(0xFFB3261E) else Color(0xFF8A5A00),
                                    fontWeight = FontWeight.Bold,
                                )
                            }
                            if (order.status == OrderStatus.CANCELED) {
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
                    if (order.status == OrderStatus.CANCELED) {
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
                    if (order.status != OrderStatus.CANCELED && !order.proofOfDeliveryPath.isNullOrBlank()) {
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
                    shape = RoundedCornerShape(18.dp),
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
private fun rememberGraceCancelSecondsLeft(pickedUpAt: String?, limitSeconds: Int = 180): Int {
    if (pickedUpAt.isNullOrBlank()) return 0
    var secondsLeft by remember(pickedUpAt) { mutableStateOf(computeGraceCancelSecondsLeft(pickedUpAt, limitSeconds)) }
    LaunchedEffect(pickedUpAt) {
        while (true) {
            secondsLeft = computeGraceCancelSecondsLeft(pickedUpAt, limitSeconds)
            delay(1000)
        }
    }
    return secondsLeft
}

private fun computeGraceCancelSecondsLeft(pickedUpAt: String, limitSeconds: Int): Int {
    return runCatching {
        val started = OffsetDateTime.parse(pickedUpAt)
        val elapsed = Duration.between(started, OffsetDateTime.now()).coerceAtLeast(Duration.ZERO).seconds.toInt()
        (limitSeconds - elapsed).coerceAtLeast(0)
    }.getOrDefault(0)
}

private fun formatGraceCountdown(secondsLeft: Int): String {
    val minutes = secondsLeft / 60
    val seconds = secondsLeft % 60
    return "%d:%02d".format(minutes, seconds)
}

@Composable
private fun ProfileScreen(
    uiState: com.membershipdeliverydriver.app.core.DriverAppState,
    onEarningsFilterSelected: (com.membershipdeliverydriver.app.core.HistoryRange) -> Unit,
    onLogout: () -> Unit,
) {
    val driver = uiState.currentDriver
    val formatter = remember { DateTimeFormatter.ofPattern("MM/dd HH:mm") }
    val filteredEarnings = uiState.earnings.filter { entry ->
        matchesHistoryRange(entry.completedAt.toLocalDate(), uiState.earningsFilter)
    }
    val filteredTotal = filteredEarnings.sumOf { it.amountMop }
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
                shape = RoundedCornerShape(26.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                border = BorderStroke(1.dp, Color(0xFFF0DFC0))
            ) {
                Column(modifier = Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(driver?.fullName ?: "未登入", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
                    Text("電話：${driver?.phone ?: "-"}", color = MaterialTheme.colorScheme.onSurfaceVariant)
                    StatusBadge(
                        label = "審核狀態：${approvalLabel(driver?.approvalStatus ?: ApprovalStatus.PENDING_APPROVAL)}",
                        highlight = driver?.approvalStatus == ApprovalStatus.APPROVED,
                    )
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
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
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
private fun SummaryCard(
    title: String,
    value: String,
    modifier: Modifier = Modifier,
) {
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(24.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        border = BorderStroke(1.dp, Color(0xFFF0DFC0))
    ) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(title, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(value, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
        }
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
        OrderStatus.ASSIGNED -> "已指派"
        OrderStatus.HEADING_TO_SHOP -> "前往商戶"
        OrderStatus.PICKED_UP -> "已取貨"
        OrderStatus.HEADING_TO_CUSTOMER -> "前往客戶"
        OrderStatus.DELIVERED -> "已送達"
        OrderStatus.CANCELED -> "已取消"
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

private fun openNavigation(
    context: android.content.Context,
    latitude: Double,
    longitude: Double,
    label: String,
) {
    val encodedLabel = Uri.encode(label)
    val intent = Intent(
        Intent.ACTION_VIEW,
        Uri.parse("geo:$latitude,$longitude?q=$latitude,$longitude($encodedLabel)"),
    )
    context.startActivity(intent)
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
