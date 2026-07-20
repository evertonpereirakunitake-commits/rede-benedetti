package com.redebenedetti.motorista

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView

    companion object {
        const val URL_INICIAL = "https://evertonpereirakunitake-commits.github.io/rede-benedetti/app/motorista-app.html"

        // Este app é EXCLUSIVO do motorista - nenhuma outra tela do site
        // (dashboard, cadastros, portal, painel do gerente...) pode abrir
        // aqui dentro. Qualquer link que fuja disso (inclusive "Sair") volta
        // pro início do app, nunca pro portal geral.
        val PAGINAS_PERMITIDAS = listOf("motorista-app.html", "motorista.html", "login.html")

        fun urlPermitida(url: String): Boolean {
            if (PAGINAS_PERMITIDAS.none { url.contains(it) }) return false
            if (url.contains("login.html") && !url.contains("tipo=motorista")) return false
            return true
        }

        // Links que NÃO são páginas do app mas devem abrir num app externo
        // (mapa/navegação/telefone), em vez de voltar pra tela inicial.
        // É o caso do "Abrir rota" -> Google Maps ou Waze.
        fun linkExterno(url: String): Boolean {
            return url.startsWith("tel:") ||
                url.startsWith("geo:") ||
                url.startsWith("waze:") ||
                url.contains("google.com/maps") ||
                url.contains("maps.google") ||
                url.contains("waze.com")
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        webView = WebView(this)
        setContentView(webView)

        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.databaseEnabled = true
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val url = request.url.toString()
                if (linkExterno(url)) {
                    try {
                        startActivity(Intent(Intent.ACTION_VIEW, request.url))
                    } catch (e: Exception) {
                        // nenhum app de mapa/telefone instalado - ignora sem quebrar
                    }
                    return true
                }
                if (urlPermitida(url)) return false
                view.loadUrl(URL_INICIAL)
                return true
            }
        }
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
