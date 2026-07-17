package com.redebenedetti.motorista

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView

    companion object {
        const val URL_INICIAL = "https://evertonpereirakunitake-commits.github.io/rede-benedetti/app/motorista-app.html"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        webView = WebView(this)
        setContentView(webView)

        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.databaseEnabled = true
        webView.webViewClient = WebViewClient()
        webView.addJavascriptInterface(PonteAndroid(this), "AndroidTracking")

        pedirPermissoesBasicas()

        webView.loadUrl(URL_INICIAL)
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }

    private fun pedirPermissoesBasicas() {
        val faltando = mutableListOf<String>()
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            faltando.add(Manifest.permission.ACCESS_FINE_LOCATION)
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            faltando.add(Manifest.permission.ACCESS_COARSE_LOCATION)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            faltando.add(Manifest.permission.POST_NOTIFICATIONS)
        }
        if (faltando.isNotEmpty()) {
            ActivityCompat.requestPermissions(this, faltando.toTypedArray(), 100)
        }
    }

    // No Android 10+ a permissão de localização em segundo plano precisa
    // ser pedida numa etapa separada, depois que a de primeiro plano já
    // foi concedida (regra do próprio Android).
    private fun pedirPermissaoSegundoPlano() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_BACKGROUND_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.ACCESS_BACKGROUND_LOCATION), 101)
        }
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == 100) {
            pedirPermissaoSegundoPlano()
        }
    }

    inner class PonteAndroid(private val activity: MainActivity) {
        @JavascriptInterface
        fun iniciarRastreio(cargaId: String, motoristaId: String) {
            activity.pedirPermissaoSegundoPlano()
            val intent = Intent(activity, LocationTrackingService::class.java)
            intent.putExtra("carga_id", cargaId)
            intent.putExtra("motorista_id", motoristaId)
            ContextCompat.startForegroundService(activity, intent)
        }

        @JavascriptInterface
        fun pararRastreio() {
            activity.stopService(Intent(activity, LocationTrackingService::class.java))
        }

        @JavascriptInterface
        fun disponivel(): Boolean = true
    }
}
