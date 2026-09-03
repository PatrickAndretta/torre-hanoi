# ---------------------------------------------------------------------------
# Torre de Hanoi - Trabalho Avaliativo de Inteligencia Artificial
#
# O trabalho pede tres algoritmos de busca (UCS, Gulosa e A*), mas exige que
# eles saiam de UMA UNICA funcao de busca. A unica coisa que muda entre eles
# e a funcao f(no) usada para escolher qual no sai da fronteira:
#
#   UCS     -> f(n) = g(n)          (so o custo ja pago)
#   Gulosa  -> f(n) = h(n)          (so o palpite do que falta)
#   A*      -> f(n) = g(n) + h(n)   (os dois)
#
# A estrutura do codigo e a mesma que usamos no labirinto da Aula 05:
# o problema e um dicionario com "inicial", "e_objetivo" e "vizinhos", e a
# busca nao sabe nada sobre Torre de Hanoi.
# ---------------------------------------------------------------------------

import time

# ---------------------------------------------------------------------------
# MODELAGEM DO PROBLEMA
# ---------------------------------------------------------------------------
# Estado: uma tupla com um pino para cada disco.
#         O indice da tupla e o numero do disco, sendo 0 o MENOR disco.
#         O valor guardado e o pino em que aquele disco esta.
#         Exemplo com 4 discos: (0, 0, 2, 1) significa
#           disco 0 (o menor) no pino A, disco 1 no pino A,
#           disco 2 no pino C e disco 3 (o maior) no pino B.
#
# Usamos tupla e nao lista porque a tupla e imutavel e, por isso, pode ser
# usada como chave do dicionario de estados alcancados. Lista daria o erro
# "unhashable type" citado no enunciado.

PINOS = (0, 1, 2)
NOMES_DOS_PINOS = ("A", "B", "C")

PINO_DE_ORIGEM = 0   # pino A: onde a torre comeca
PINO_DE_DESTINO = 2  # pino C: onde a torre precisa terminar

# Limite de tempo adotado pela equipe. Se uma busca passar disso, ela e
# interrompida e reportada como "nao concluiu", como pede o enunciado.
LIMITE_DE_TEMPO_EM_SEGUNDOS = 60


def estado_inicial(total_de_discos):
  # Todos os discos empilhados no pino de origem.
  return tuple(PINO_DE_ORIGEM for _ in range(total_de_discos))


def estado_objetivo(total_de_discos):
  # Todos os discos empilhados no pino de destino.
  return tuple(PINO_DE_DESTINO for _ in range(total_de_discos))


def disco_do_topo(estado, pino):
  # O disco do topo de um pino e sempre o MENOR disco que esta nele.
  # Como o indice 0 e o menor disco, basta varrer do inicio e devolver
  # o primeiro que estiver naquele pino.
  for disco in range(len(estado)):
    if estado[disco] == pino:
      return disco

  return None  # pino vazio


def movimento_e_valido(estado, disco, pino_de_destino):
  # Um movimento so vale se o pino de destino estiver vazio ou se o disco
  # que esta no topo dele for MAIOR que o disco que estamos movendo.
  disco_no_destino = disco_do_topo(estado, pino_de_destino)

  if disco_no_destino is None:
    return True

  return disco_no_destino > disco


def vizinhos(estado):
  # Devolve a lista de (novo_estado, custo_da_acao, acao) alcancaveis.
  # A acao e a tripla (disco, pino de origem, pino de destino), guardada
  # para conseguirmos imprimir a sequencia de jogadas no final.
  saidas = []

  for origem in PINOS:
    disco = disco_do_topo(estado, origem)

    if disco is None:
      continue  # nao ha o que mover desse pino

    for destino in PINOS:
      if destino == origem:
        continue

      if not movimento_e_valido(estado, disco, destino):
        continue

      novo_estado = list(estado)
      novo_estado[disco] = destino

      # Custo 1 por movimento, como manda a ficha do problema.
      saidas.append((tuple(novo_estado), 1, (disco, origem, destino)))

  return saidas


# ---------------------------------------------------------------------------
# HEURISTICA
# ---------------------------------------------------------------------------
# h(n) = quantidade de discos que ainda nao estao no pino de destino.
#
# Relaxamento: apagamos a regra "nunca coloque um disco maior sobre um menor"
# E tambem a regra "so se move o disco do topo". Nesse mundo relaxado, cada
# disco fora do lugar e resolvido com exatamente um movimento, e o custo da
# solucao relaxada e o numero de discos fora do lugar.
#
# Admissivel porque no problema real cada disco fora do lugar precisa ser
# movido pelo menos uma vez, entao h(n) nunca passa do custo real.
# E uma heuristica FRACA: h(n) vale no maximo n, enquanto a solucao otima
# custa 2^n - 1. A discussao desse ponto e uma das partes centrais do relatorio.

# A heuristica e consultada muitas vezes por no, entao guardamos o valor ja
# calculado de cada estado. E so uma otimizacao de desempenho: nao muda o
# resultado da busca, apenas evita recontar os discos toda vez.
CACHE_DA_HEURISTICA = {}


def heuristica_discos_fora_do_lugar(estado):
  if estado in CACHE_DA_HEURISTICA:
    return CACHE_DA_HEURISTICA[estado]

  discos_fora = 0

  for pino_do_disco in estado:
    if pino_do_disco != PINO_DE_DESTINO:
      discos_fora += 1

  CACHE_DA_HEURISTICA[estado] = discos_fora
  return discos_fora


def criar_problema(total_de_discos):
  objetivo = estado_objetivo(total_de_discos)

  return {
    "inicial": estado_inicial(total_de_discos),
    "objetivo": objetivo,
    "e_objetivo": lambda estado: estado == objetivo,
    "vizinhos": vizinhos
  }


# ---------------------------------------------------------------------------
# A BUSCA (uma so, parametrizada por f)
# ---------------------------------------------------------------------------

def criar_no(estado, pai, acao, custo, profundidade):
  return {
    "estado": estado,
    "pai": pai,
    "acao": acao,
    "custo": custo,
    "profundidade": profundidade
  }


def remover_menor_f(fronteira, f):
  # Escolhe o no de menor f e o retira da fronteira.
  # Fizemos a varredura linear de proposito, para o codigo ficar facil de
  # explicar no seminario. Uma fila de prioridade seria mais rapida, e essa
  # escolha esta registrada no relatorio.
  indice_menor_f = 0
  menor_valor_de_f = f(fronteira[0])

  for i in range(1, len(fronteira)):
    valor_de_f = f(fronteira[i])

    if valor_de_f < menor_valor_de_f:
      indice_menor_f = i
      menor_valor_de_f = valor_de_f

  return fronteira.pop(indice_menor_f)


def caminho_ate(no):
  # Sobe pelos pais reconstruindo a sequencia de estados e de acoes.
  estados = []
  acoes = []

  while no is not None:
    estados.append(no["estado"])

    if no["acao"] is not None:
      acoes.append(no["acao"])

    no = no["pai"]

  estados.reverse()
  acoes.reverse()

  return estados, acoes


def busca(problema, f, limite_de_tempo=LIMITE_DE_TEMPO_EM_SEGUNDOS):
  # Esta e a UNICA funcao de busca do trabalho.
  # Trocando o f que chega por parametro, ela vira UCS, Gulosa ou A*.
  comeco = time.perf_counter()

  inicial = problema["inicial"]
  fronteira = [criar_no(inicial, None, None, 0, 0)]

  # "alcancados" guarda o melhor custo ja conhecido para cada estado.
  # Sem esse controle a busca nunca termina, porque a Torre de Hanoi
  # permite desfazer qualquer movimento e voltar ao estado anterior.
  alcancados = {inicial: 0}

  # No EXPANDIDO e o que saiu da fronteira e teve os filhos gerados.
  # No GERADO e o que foi criado e colocado na fronteira.
  # A metrica que o trabalho pede e a de expandidos.
  nos_expandidos = 0
  nos_gerados = 1

  while len(fronteira) > 0:
    tempo_gasto = time.perf_counter() - comeco

    # Limite de tempo definido pela equipe.
    if tempo_gasto > limite_de_tempo:
      return {
        "concluiu": False,
        "motivo": "limite de tempo",
        "expandidos": nos_expandidos,
        "gerados": nos_gerados,
        "tempo": tempo_gasto
      }

    no = remover_menor_f(fronteira, f)

    if problema["e_objetivo"](no["estado"]):
      estados, acoes = caminho_ate(no)

      return {
        "concluiu": True,
        "motivo": "objetivo encontrado",
        "caminho": estados,
        "acoes": acoes,
        "custo": no["custo"],
        "passos": no["profundidade"],
        "expandidos": nos_expandidos,
        "gerados": nos_gerados,
        "tempo": time.perf_counter() - comeco
      }

    nos_expandidos += 1

    for vizinho, custo_da_acao, acao in problema["vizinhos"](no["estado"]):
      novo_custo = no["custo"] + custo_da_acao

      # So vale a pena guardar o vizinho se ele e novo ou se chegamos
      # nele por um caminho mais barato do que o ja conhecido.
      if vizinho not in alcancados or novo_custo < alcancados[vizinho]:
        alcancados[vizinho] = novo_custo
        nos_gerados += 1
        fronteira.append(
          criar_no(vizinho, no, acao, novo_custo, no["profundidade"] + 1)
        )

  # Fronteira esvaziou sem achar o objetivo.
  return {
    "concluiu": False,
    "motivo": "fronteira vazia",
    "expandidos": nos_expandidos,
    "gerados": nos_gerados,
    "tempo": time.perf_counter() - comeco
  }


# ---------------------------------------------------------------------------
# AS TRES FUNCOES f
# ---------------------------------------------------------------------------

def f_ucs(no):
  # Busca de Custo Uniforme: olha so o custo ja pago.
  return no["custo"]


def f_gulosa(no):
  # Busca Gulosa: olha so o palpite do que falta.
  return heuristica_discos_fora_do_lugar(no["estado"])


def f_a_estrela(no):
  # A*: soma o custo ja pago com o palpite do que falta.
  return no["custo"] + heuristica_discos_fora_do_lugar(no["estado"])


ALGORITMOS = [
  {"nome": "UCS", "heuristica": "nao usa", "f": f_ucs},
  {"nome": "Gulosa", "heuristica": "discos fora do lugar", "f": f_gulosa},
  {"nome": "A*", "heuristica": "discos fora do lugar", "f": f_a_estrela}
]


# ---------------------------------------------------------------------------
# IMPRESSAO DOS RESULTADOS
# ---------------------------------------------------------------------------

def solucao_otima_conhecida(total_de_discos):
  # A Torre de Hanoi tem gabarito exato: 2^n - 1 movimentos.
  return 2 ** total_de_discos - 1


def descrever_acao(acao):
  disco, origem, destino = acao
  return "mover o disco {} do pino {} para o pino {}".format(
    disco + 1, NOMES_DOS_PINOS[origem], NOMES_DOS_PINOS[destino]
  )


def descrever_estado(estado):
  # Mostra o conteudo de cada pino, do disco maior (base) para o menor (topo).
  partes = []

  for pino in PINOS:
    discos = [disco + 1 for disco in range(len(estado)) if estado[disco] == pino]
    discos.reverse()
    partes.append("{}: {}".format(NOMES_DOS_PINOS[pino], discos))

  return "  |  ".join(partes)


def executar_comparacao(total_de_discos, limite_de_tempo=LIMITE_DE_TEMPO_EM_SEGUNDOS):
  # Roda os tres algoritmos sobre o mesmo problema e devolve a lista de linhas.
  problema = criar_problema(total_de_discos)
  linhas = []

  for algoritmo in ALGORITMOS:
    resultado = busca(problema, algoritmo["f"], limite_de_tempo)
    resultado["algoritmo"] = algoritmo["nome"]
    resultado["heuristica"] = algoritmo["heuristica"]
    linhas.append(resultado)

  return linhas


def imprimir_tabela(total_de_discos, linhas, limite_de_tempo):
  otimo = solucao_otima_conhecida(total_de_discos)

  print()
  print("=" * 78)
  print("TORRE DE HANOI com {} discos".format(total_de_discos))
  print("Solucao otima conhecida por formula (2^n - 1): {} movimentos".format(otimo))
  print("Limite de tempo adotado pela equipe: {} s".format(limite_de_tempo))
  print("=" * 78)

  cabecalho = "{:<10} {:<24} {:>7} {:>8} {:>13} {:>12}".format(
    "Algoritmo", "Heuristica", "Custo", "Passos", "Expandidos", "Tempo (s)"
  )
  print(cabecalho)
  print("-" * 78)

  for linha in linhas:
    if linha["concluiu"]:
      custo = str(linha["custo"])
      passos = str(linha["passos"])
      tempo = "{:.4f}".format(linha["tempo"])
    else:
      custo = "-"
      passos = "-"
      tempo = "nao concluiu em {:.0f}s".format(limite_de_tempo)

    print("{:<10} {:<24} {:>7} {:>8} {:>13} {:>12}".format(
      linha["algoritmo"], linha["heuristica"], custo, passos,
      linha["expandidos"], tempo
    ))

  print("-" * 78)


def imprimir_solucao(linha, total_de_discos):
  # Imprime a sequencia de acoes e de estados da solucao encontrada.
  if not linha["concluiu"]:
    print("{}: nao concluiu ({}).".format(linha["algoritmo"], linha["motivo"]))
    return

  print()
  print("Solucao encontrada pelo {} ({} movimentos):".format(
    linha["algoritmo"], linha["passos"]
  ))

  print("  estado inicial   ->  {}".format(descrever_estado(linha["caminho"][0])))

  for numero, acao in enumerate(linha["acoes"], start=1):
    estado_depois = linha["caminho"][numero]
    print("  {:>3}. {:<40} ->  {}".format(
      numero, descrever_acao(acao), descrever_estado(estado_depois)
    ))


def principal():
  # Roteiro de teste sugerido pela ficha do problema: 3, 4, 5, 6 e 7 discos.
  limite_de_tempo = LIMITE_DE_TEMPO_EM_SEGUNDOS

  for total_de_discos in (3, 4, 5, 6, 7):
    linhas = executar_comparacao(total_de_discos, limite_de_tempo)
    imprimir_tabela(total_de_discos, linhas, limite_de_tempo)

    # Conferencia com o gabarito: o UCS e o A* devem bater com 2^n - 1.
    otimo = solucao_otima_conhecida(total_de_discos)
    for linha in linhas:
      if linha["concluiu"] and linha["algoritmo"] in ("UCS", "A*"):
        situacao = "OK" if linha["custo"] == otimo else "DIVERGENTE"
        print("  conferencia {:<8} custo {:>4} vs otimo {:>4}  [{}]".format(
          linha["algoritmo"], linha["custo"], otimo, situacao
        ))

  # Mostra a sequencia de jogadas para uma instancia pequena.
  print()
  print("=" * 78)
  print("SEQUENCIA DE JOGADAS (instancia de 3 discos)")
  print("=" * 78)

  for linha in executar_comparacao(3, limite_de_tempo):
    imprimir_solucao(linha, 3)


if __name__ == "__main__":
  principal()
