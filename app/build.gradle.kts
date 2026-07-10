import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}


val localProperties = Properties().apply {
    val localFile = rootProject.file("local.properties")
    if (localFile.exists()) {
        localFile.inputStream().use { load(it) }
    }
}

fun localConfig(name: String, defaultValue: String = ""): String =
    (localProperties.getProperty(name) ?: System.getenv(name.replace('.', '_').uppercase()) ?: defaultValue)

android {
    namespace = "com.membershipdeliverydriver.app"
    compileSdk = 36
    buildToolsVersion = "36.0.0"

    defaultConfig {
        applicationId = "com.membershipdeliverydriver.app"
        minSdk = 27
        targetSdk = 36
        versionCode = 107
        versionName = "1.0.7"
        buildConfigField("String", "SUPABASE_URL", "\"https://vdhdgxumnlnekdslxgmv.supabase.co\"")
        buildConfigField("String", "SUPABASE_ANON_KEY", "\"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZkaGRneHVtbmxuZWtkc2x4Z212Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwNjg5NDgsImV4cCI6MjA5ODY0NDk0OH0.htqk2Nt5hoBZmNQps_wZauTKExZl38lJejqKKghWvM0\"")
        // NOTE: Must point to the deployed backoffice/API domain.
        buildConfigField("String", "API_BASE_URL", "\"https://macau-delivery.vercel.app\"")
        buildConfigField("String", "JWT_ISSUER", "\"membership-driver\"")
        buildConfigField("String", "JWT_AUDIENCE", "\"membership-driver-api\"")
        buildConfigField("boolean", "MQTT_ENABLED", localConfig("mqtt.enabled", "false"))
        buildConfigField("String", "MQTT_HOST", "\"${localConfig("mqtt.host")}\"")
        buildConfigField("int", "MQTT_PORT", localConfig("mqtt.port", "8883"))
        buildConfigField("String", "MQTT_USERNAME", "\"${localConfig("mqtt.username")}\"")
        buildConfigField("String", "MQTT_PASSWORD", "\"${localConfig("mqtt.password")}\"")

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        vectorDrawables {
            useSupportLibrary = true
        }

        ndk {
            abiFilters += listOf("armeabi-v7a", "arm64-v8a")
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.7")
    implementation("androidx.activity:activity-compose:1.9.3")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7")
    implementation("androidx.navigation:navigation-compose:2.8.5")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.10.2")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-play-services:1.10.2")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("org.eclipse.paho:org.eclipse.paho.client.mqttv3:1.2.5")

    implementation("androidx.compose.ui:ui:1.7.6")
    implementation("androidx.compose.ui:ui-tooling-preview:1.7.6")
    implementation("androidx.compose.material:material:1.7.6")
    implementation("androidx.compose.material3:material3:1.3.1")
    implementation("androidx.compose.material:material-icons-extended:1.7.6")
    implementation("io.coil-kt:coil-compose:2.7.0")
    implementation("io.coil-kt:coil-gif:2.7.0")

    debugImplementation("androidx.compose.ui:ui-tooling:1.7.6")
    debugImplementation("androidx.compose.ui:ui-test-manifest:1.7.6")

    androidTestImplementation("androidx.test.ext:junit:1.2.1")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.6.1")
    androidTestImplementation("androidx.compose.ui:ui-test-junit4:1.7.6")
    testImplementation("junit:junit:4.13.2")
}
