package com.redebenedetti.motorista

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Build
import android.os.Bundle
import android.os.IBinder
import androidx.core.app.NotificationCompat
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

// Serviço em primeiro plano (foreground service): continua rodando mesmo
// com a tela apagada ou o app em segundo plano, porque o Android trata
// isso como uma tarefa "visível" (por causa da notificação fixa).
class LocationTrackingService : Service(), LocationListener {

    companion object {
        const val CANAL_ID = "rastreio_carga"
        const val NOTIFICACAO_ID = 1
        const val INTERVALO_MS = 60_000L // 1 minuto
        const val DISTANCIA_MIN_M = 30f

        const val SUPABASE_URL = "https://irsebnociooeyqneygav.supabase.co"
        const val SUPABASE_ANON_KEY = "sb_publishable_7Ky8LcZcY6KtYwqWjJegyg_oubMKYJc"
    }

    private lateinit var locationManager: LocationManager
    private var cargaId: String? = null
    private var motoristaId: String? = null

    override fun onCreate() {
        super.onCreate()
        locationManager = getSystemService(Context.LOCATION_SERVICE) as LocationManager
        criarCanalNotificacao()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        cargaId = intent?.getStringExtra("carga_id") ?: cargaId
        motoristaId = intent?.getStringExtra("motorista_id") ?: motoristaId

        startForeground(NOTIFICACAO_ID, criarNotificacao())
        iniciarEscutaLocalizacao()

        return START_STICKY
    }

    private fun iniciarEscutaLocalizacao() {
        try {
            locationManager.requestLocationUpdates(
                LocationManager.GPS_PROVIDER, INTERVALO_MS, DISTANCIA_MIN_M, this
            )
        } catch (e: SecurityException) {
            // sem permissão de localização ainda - a MainActivity cuida de pedir
        }
        try {
            locationManager.requestLocationUpdates(
                LocationManager.NETWORK_PROVIDER, INTERVALO_MS, DISTANCIA_MIN_M, this
            )
        } catch (e: Exception) {
            // provider de rede pode não existir em alguns aparelhos - tudo bem, GPS já cobre
        }
    }

    override fun onLocationChanged(location: Location) {
        enviarPosicao(location.latitude, location.longitude)
    }

    @Deprecated("Deprecated in Java")
    override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}
    override fun onProviderEnabled(provider: String) {}
    override fun onProviderDisabled(provider: String) {}

    private fun enviarPosicao(lat: Double, lng: Double) {
        val carga = cargaId ?: return
        val motorista = motoristaId ?: return
        Thread {
            try {
                val url = URL("$SUPABASE_URL/functions/v1/minhas-cargas")
                val conn = url.openConnection() as HttpURLConnection
                conn.requestMethod = "POST"
                conn.setRequestProperty("Content-Type", "application/json")
                conn.setRequestProperty("apikey", SUPABASE_ANON_KEY)
                conn.setRequestProperty("Authorization", "Bearer $SUPABASE_ANON_KEY")
                conn.doOutput = true

                val corpo = JSONObject()
                corpo.put("acao", "atualizar_posicao")
                corpo.put("carga_id", carga)
                corpo.put("motorista_id", motorista)
                corpo.put("latitude", lat)
                corpo.put("longitude", lng)

                conn.outputStream.use { it.write(corpo.toString().toByteArray()) }
                conn.responseCode // dispara a requisição
                conn.disconnect()
            } catch (e: Exception) {
                // sem internet no momento - o próximo ciclo tenta de novo
            }
        }.start()
    }

    private fun criarCanalNotificacao() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val canal = NotificationChannel(
                CANAL_ID, "Rastreio de entrega", NotificationManager.IMPORTANCE_LOW
            )
            canal.description = "Mostra que o app está enviando sua localização durante a entrega"
            val nm = getSystemService(NotificationManager::class.java)
            nm.createNotificationChannel(canal)
        }
    }

    private fun criarNotificacao(): Notification {
        val abrirApp = packageManager.getLaunchIntentForPackage(packageName)
        val pendingIntent = PendingIntent.getActivity(
            this, 0, abrirApp,
            PendingIntent.FLAG_IMMUTABLE
        )
        return NotificationCompat.Builder(this, CANAL_ID)
            .setContentTitle("Rede Benedetti - Entrega em andamento")
            .setContentText("Enviando sua localização pro gerente do posto")
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .build()
    }

    override fun onDestroy() {
        super.onDestroy()
        locationManager.removeUpdates(this)
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
