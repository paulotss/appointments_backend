import telnetlib
import re
import time
import os
import logging
from datetime import datetime, timezone
import requests
from requests.adapters import HTTPAdapter, Retry

# --- CONFIGURAÇÕES DE AMBIENTE ---
HOST = os.getenv("PABX_HOST", "192.168.1.250")
PASS = os.getenv("PABX_PASS", "1234")
API_URL = os.getenv("APPOINTMENTS_API_URL", "https://appointments-backend-6mjr.onrender.com/api")
API_TIMEOUT = float(os.getenv("APPOINTMENTS_API_TIMEOUT", "5"))

TAMANHO_RAMAL_INTERNO = 3 
IGNORED_EXTENSIONS = {"61", "192", "100"}  # Adicionado o 100 e 192 aos ignorados
DEDUP_WINDOW_SECONDS = 4

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("pabx-monitor")

def build_http_session():
    session = requests.Session()
    retry = Retry(total=3, backoff_factor=0.5, status_forcelist=(500, 502, 503, 504))
    session.mount("https://", HTTPAdapter(max_retries=retry))
    session.mount("http://", HTTPAdapter(max_retries=retry))
    session.headers.update({"Content-Type": "application/json"})
    return session

def registrar_chamada(session, origin, destination, extension, status):
    if origin in IGNORED_EXTENSIONS or not origin or "Desconhecido" in origin: 
        return
    
    payload = {
        "receivedAt": datetime.now(timezone.utc).isoformat(),
        "origin": str(origin),
        "destination": str(destination),
        "extension": int(extension) if str(extension).isdigit() else 0,
        "status": status,
    }
    try:
        resp = session.post(f"{API_URL}/calls", json=payload, timeout=API_TIMEOUT)
        resp.raise_for_status()
        log.info(f"📡 API ENVIADO COM SUCESSO: [{status}] {origin} -> {destination} (Ramal: {extension})")
    except Exception as exc:
        log.error(f"❌ Erro API: {exc}")

def autenticar(tn):
    index, _, _ = tn.expect([b"login:", b"Password:", b"password:"], timeout=10)
    if index == 0:
        tn.write(b"admin\n")
        tn.read_until(b"Password:", timeout=5)
    tn.write(PASS.encode("ascii") + b"\n")

def monitorar():
    session = build_http_session()
    
    while True:
        try:
            log.info(f"🔗 Conectando ao CIP 850 em {HOST}...")
            tn = telnetlib.Telnet(HOST, port=23, timeout=10)
            autenticar(tn)
            
            log.info("🔓 Autenticado. Acessando console...")
            time.sleep(1)
            tn.read_very_eager()
            
            tn.write(b"asterisk -rvvv\n")
            time.sleep(1)
            
            tn.write(b"core set verbose 1\n")
            time.sleep(0.5)
            tn.read_very_eager()
            
            log.info("🚀 Monitor Ativo e Otimizado. Escutando chamadas...")

            identificador_origem = "Desconhecido"
            destino_tentativa = ""
            ramais_que_tocaram = set()
            ramal_que_atendeu = ""
            foi_atendida = False
            em_chamada = False
            ultimo_tempo_registro = 0

            while True:
                raw = tn.read_until(b"\n", timeout=60).decode("ascii", errors="ignore").strip()
                if not raw: continue

                # Filtro rápido de descarte de lixo para poupar CPU
                if any(x in raw for x in ["Early media", "rtp.c", "failed for", "Can't add more headers", "didnt't find peer", "Registration from"]):
                    continue

                # 1. CAPTURA DE ORIGEM
                if "get_destination: From :" in raw:
                    m_origem = re.search(r"From\s*:\s*(\+?\d+)", raw)
                    if m_origem:
                        origem_prov = m_origem.group(1).strip()
                        if origem_prov in IGNORED_EXTENSIONS: continue
                        
                        identificador_origem = origem_prov
                        em_chamada, foi_atendida, destino_tentativa, ramal_que_atendeu = True, False, "", ""
                        ramais_que_tocaram.clear()
                        log.info(f"📞 Origem Detectada: {identificador_origem}")

                # 2. CAPTURA DE DESTINO INICIAL
                if em_chamada and "get_destination: Uri :" in raw:
                    m_dest = re.search(r"Uri\s*:\s*(\+?\d+)", raw)
                    if m_dest:
                        destino_tentativa = m_dest.group(1).strip()
                        log.info(f"🎯 Destino Inicial: {destino_tentativa}")

                # 3. CAPTURA DOS RAMAIS QUE ESTÃO TOCANDO (app_dial.c)
                if em_chamada and "app_dial.c" in raw and "SIP/" in raw:
                    m_ramal_alvo = re.search(r"SIP/(\d{3,4})", raw)
                    if m_ramal_alvo:
                        r_detectado = m_ramal_alvo.group(1).strip()
                        if r_detectado not in IGNORED_EXTENSIONS:
                            log.info(f"🔔 Chamada tocando no Ramal Interno: {r_detectado}")
                            
                            # Se a chamada é RECEBIDA e esse mesmo ramal repete isolado segundos depois, 
                            # significa que ele atendeu a chamada da fila!
                            if len(identificador_origem) > TAMANHO_RAMAL_INTERNO:
                                if r_detectado in ramais_que_tocaram and not foi_atendida:
                                    ramal_que_atendeu = r_detectado
                                    foi_atendida = True
                                    agora = time.time()
                                    if (agora - ultimo_tempo_registro) > DEDUP_WINDOW_SECONDS:
                                        ultimo_tempo_registro = agora
                                        registrar_chamada(session, identificador_origem, ramal_que_atendeu, ramal_que_atendeu, "ATENDIDO")
                                else:
                                    ramais_que_tocaram.add(r_detectado)

                # 4. GATILHO DE ATENDIMENTO PARA CHAMADAS REALIZADAS (Saindo da empresa)
                if em_chamada and "ippbx_init_vars:" in raw and len(identificador_origem) <= TAMANHO_RAMAL_INTERNO:
                    if not foi_atendida:
                        foi_atendida = True
                        agora = time.time()
                        if (agora - ultimo_tempo_registro) > DEDUP_WINDOW_SECONDS:
                            ultimo_tempo_registro = agora
                            final_dest = destino_tentativa if destino_tentativa else "Externo"
                            registrar_chamada(session, identificador_origem, final_dest, identificador_origem, "REALIZADO")

                # 5. EVENTO: FINALIZAÇÃO (Trata Não Atendidas)
                if any(x in raw for x in ["Hangup", "Complete", "h@ext"]):
                    if em_chamada and not foi_atendida:
                        if len(identificador_origem) > TAMANHO_RAMAL_INTERNO:
                            # Pegamos o primeiro ramal da fila que tocou e ninguém atendeu para marcar como destino perdido
                            dest_perdi = list(ramais_que_tocaram)[0] if ramais_que_tocaram else destino_tentativa
                            registrar_chamada(session, identificador_origem, dest_perdi, 0, "NAO_ATENDIDO")
                    
                    em_chamada, foi_atendida = False, False
                    identificador_origem, ramal_que_atendeu = "Desconhecido", ""
                    ramais_que_tocaram.clear()

        except (ConnectionRefusedError, TimeoutError, EOFError) as e:
            log.error(f"⚠️ Erro Telnet: {e}. Reconectando em 10s...")
            time.sleep(10)
        except Exception as e:
            log.exception(f"💥 Erro inesperado: {e}")
            time.sleep(10)

if __name__ == "__main__":
    monitorar()
