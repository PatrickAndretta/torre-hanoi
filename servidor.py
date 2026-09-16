# ---------------------------------------------------------------------------
# Servidor da interface grafica da Torre de Hanoi (extra opcional do trabalho).
#
# Usa apenas a biblioteca padrao do Python (http.server e json). Nenhuma
# biblioteca de busca e usada aqui: o servidor so chama as funcoes de hanoi.py
# e devolve os resultados em JSON para a pagina web desenhar.
#
# Para rodar:  python3 servidor.py
# Depois abra: http://localhost:8000
# ---------------------------------------------------------------------------

import json
import os
import urllib.parse
from http.server import HTTPServer, SimpleHTTPRequestHandler

import hanoi

PASTA_DA_INTERFACE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "web")

PORTA = 8000

NOMES_DOS_PINOS = ("A", "B", "C")


def descrever_acao(acao):
  disco, origem, destino = acao
  return "mover o disco {} do pino {} para o pino {}".format(
    disco + 1, NOMES_DOS_PINOS[origem], NOMES_DOS_PINOS[destino]
  )

# Teto de discos aceito pela interface, para nao travar o navegador esperando.
MAXIMO_DE_DISCOS = 12


def montar_resposta(total_de_discos, limite_de_tempo):
  # Roda os tres algoritmos e converte o resultado para um formato que o
  # JavaScript consiga ler (tuplas viram listas).
  linhas = hanoi.executar_comparacao(total_de_discos, limite_de_tempo)
  resultados = []

  for linha in linhas:
    resultado = {
      "algoritmo": linha["algoritmo"],
      "heuristica": linha["heuristica"],
      "concluiu": linha["concluiu"],
      "motivo": linha["motivo"],
      "expandidos": linha["expandidos"],
      "gerados": linha["gerados"],
      "tempo": linha["tempo"]
    }

    if linha["concluiu"]:
      resultado["custo"] = linha["custo"]
      resultado["passos"] = linha["passos"]
      resultado["caminho"] = [list(estado) for estado in linha["caminho"]]
      resultado["acoes"] = [list(acao) for acao in linha["acoes"]]
      resultado["descricoes"] = [descrever_acao(acao) for acao in linha["acoes"]]
    else:
      resultado["custo"] = None
      resultado["passos"] = None
      resultado["caminho"] = []
      resultado["acoes"] = []
      resultado["descricoes"] = []

    resultados.append(resultado)

  return {
    "discos": total_de_discos,
    "limite": limite_de_tempo,
    "otimo": hanoi.solucao_otima_conhecida(total_de_discos),
    "nomes_dos_pinos": list(NOMES_DOS_PINOS),
    "resultados": resultados
  }


class Manipulador(SimpleHTTPRequestHandler):
  # Serve os arquivos estaticos da pasta web/ e trata a rota /api/buscar.

  def __init__(self, *args, **kwargs):
    super().__init__(*args, directory=PASTA_DA_INTERFACE, **kwargs)

  def do_GET(self):
    endereco = urllib.parse.urlparse(self.path)

    if endereco.path == "/api/buscar":
      self.responder_busca(urllib.parse.parse_qs(endereco.query))
      return

    super().do_GET()

  def responder_busca(self, parametros):
    try:
      total_de_discos = int(parametros.get("discos", ["3"])[0])
      limite_de_tempo = float(parametros.get("limite", [hanoi.LIMITE_DE_TEMPO_EM_SEGUNDOS])[0])
    except ValueError:
      self.responder_json({"erro": "parametros invalidos"}, codigo=400)
      return

    if total_de_discos < 1 or total_de_discos > MAXIMO_DE_DISCOS:
      self.responder_json(
        {"erro": "numero de discos deve ficar entre 1 e {}".format(MAXIMO_DE_DISCOS)},
        codigo=400
      )
      return

    if limite_de_tempo <= 0 or limite_de_tempo > 3600:
      self.responder_json({"erro": "limite de tempo invalido"}, codigo=400)
      return

    self.responder_json(montar_resposta(total_de_discos, limite_de_tempo))

  def responder_json(self, dados, codigo=200):
    corpo = json.dumps(dados).encode("utf-8")

    self.send_response(codigo)
    self.send_header("Content-Type", "application/json; charset=utf-8")
    self.send_header("Content-Length", str(len(corpo)))
    self.end_headers()
    self.wfile.write(corpo)

  def log_message(self, formato, *args):
    # Silencia o log de cada requisicao para o terminal ficar limpo na demo.
    pass


def principal():
  servidor = HTTPServer(("127.0.0.1", PORTA), Manipulador)
  print("Interface da Torre de Hanoi rodando em http://localhost:{}".format(PORTA))
  print("Pressione Ctrl+C para encerrar.")

  try:
    servidor.serve_forever()
  except KeyboardInterrupt:
    print("\nServidor encerrado.")
    servidor.server_close()


if __name__ == "__main__":
  principal()
