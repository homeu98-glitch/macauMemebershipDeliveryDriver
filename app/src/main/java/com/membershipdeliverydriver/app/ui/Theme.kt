package com.membershipdeliverydriver.app.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable

private val LightColors = lightColorScheme(
    primary = androidx.compose.ui.graphics.Color(0xFF36A7FF),
    onPrimary = androidx.compose.ui.graphics.Color(0xFFFFFFFF),
    secondary = androidx.compose.ui.graphics.Color(0xFF6EDAC4),
    onSecondary = androidx.compose.ui.graphics.Color(0xFF123B37),
    tertiary = androidx.compose.ui.graphics.Color(0xFFFFC85C),
    background = androidx.compose.ui.graphics.Color(0xFFF5FBFF),
    onBackground = androidx.compose.ui.graphics.Color(0xFF17324F),
    surface = androidx.compose.ui.graphics.Color(0xFFFFFFFF),
    onSurface = androidx.compose.ui.graphics.Color(0xFF17324F),
    surfaceVariant = androidx.compose.ui.graphics.Color(0xFFE8F5FF),
    outline = androidx.compose.ui.graphics.Color(0xFFC3DBF5),
)

@Composable
fun MembershipDriverTheme(
    darkTheme: Boolean = false,
    content: @Composable () -> Unit,
) {
    MaterialTheme(
        colorScheme = LightColors,
        content = content,
    )
}
