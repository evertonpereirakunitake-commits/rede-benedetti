package com.redebenedetti.gerente

import android.os.Bundle
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView

    companion object {
        const val URL_INICIAL = "https://evertonpereirakunitake-commits.github.io/rede-benedetti/app/gerente-app.html"

        // Este app é EXCLUSIVO do gerente - nenhuma outra tela do site
        // (dashboard, cadastros, portal, telas do motorista...) pode abrir
        // aqui dentro. Qualquer link que fuja disso (inclusive "Sair") volta
        // pro início do app, nunca pro portal geral.
        val PAGINAS_PERMITIDAS = listOf("gerente-app.html", "painel_gerente.html", "login.html")

        fun urlPermitida(url: String): Boolean {
            if (PAGINAS_PERMITIDAS.none { url.contains(it) }) return false
            if (url.contains("login.html") && !url.contains("tipo=gerente")) return false
            return true
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
                if (urlPermitida(url)) return false
                view.loadUrl(URL_INICIAL)
                return true
            }
        }

        webView.loadUrl(URL_INICIAL)
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }
}
