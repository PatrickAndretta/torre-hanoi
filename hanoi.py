import time

# Estado: uma tupla, onde o índice representa o disco, e o valor representa o pino
# Exemplo com 4 discos: (0, 0, 2, 1) significa
# disco 0 (o menor) no pino A, disco 1 no pino A,
# disco 2 no pino C e disco 3 (o maior) no pino B.

# Usamos tupla e nao lista porque a tupla e imutável e, por isso, pode ser
# usada como chave do dicionário de estados alcançados. Lista daria o erro
# "unhashable type" citado no enunciado.

PINOS = (0, 1, 2)
NOMES_DOS_PINOS = ("A", "B", "C")

PINO_DE_ORIGEM = 0   # pino A: onde a torre comeca
PINO_DE_DESTINO = 2  # pino C: onde a torre precisa terminar

# Limite de tempo adotado pela equipe. Se uma busca passar disso, ela e
# interrompida e reportada como "não concluída", como pede o enunciado.
LIMITE_DE_TEMPO_EM_SEGUNDOS = 60


def estado_inicial(total_de_discos):
  # Retorna uma tupla onde, se for passado um total de 4 discos, vai retornar (0, 0, 0, 0)
  return tuple(PINO_DE_ORIGEM for _ in range(total_de_discos))

# Essas duas funções percorre um for onde retorna o valor do pino definido anteriormente

def estado_objetivo(total_de_discos):
  # Retorna uma tupla onde, se for passado um total de 4 discos, vai retornar (2, 2, 2, 2)
  return tuple(PINO_DE_DESTINO for _ in range(total_de_discos))


def disco_do_topo(estado, pino):
  # O disco do topo de um pino é sempre o MENOR disco que está nele.
  # Como o índice 0 e o menor disco, basta varrer do início e devolver
  # o primeiro que estiver naquele pino.
  # (0, 0, 2, 1) - pino 1 -> vai percorrer o estado inteiro (3) e se o valor na tupla for igual ao
  # pino passado, vai retornar aquele índice, que é o menor disco no pino - Aqui vai ser 3
  for disco in range(len(estado)):
    if estado[disco] == pino:
      return disco

  return None  # pino vazio


def movimento_e_valido(estado, disco, pino_de_destino):
  # Um movimento só vale se o pino de destino estiver vazio ou se o disco
  # que está no topo dele for MAIOR que o disco que estamos movendo.
  disco_no_destino = disco_do_topo(estado, pino_de_destino)

  if disco_no_destino is None:
    return True

  return disco_no_destino > disco

# Retorna uma lista de caminhos possíveis a partir daquele estado
def vizinhos(estado):
  # Devolve a lista de (novo_estado, custo_da_acao, acao) alcançáveis.
  # A acao é a tupla (disco, pino de origem, pino de destino), guardada
  # para conseguirmos imprimir a sequência de jogadas no final.
  saidas = []

  # for (0, 1, 2)
  for origem in PINOS:
    disco = disco_do_topo(estado, origem)

    if disco is None:
      continue  # não tem disco nesse pino

    # for (0, 1, 2) - se forem iguais, continue, não há motivos para mexer algo do pino A para A
    for destino in PINOS:
      if destino == origem:
        continue

      if not movimento_e_valido(estado, disco, destino):
        continue

      # após fazer todas as verificações, ele transforma o estado (que é uma tupla) em um lista
      # para poder modificá-la, onde ele vai alterar o pino do disco que está sendo verificado
      # algo tipo -> (0, 0, 2 ,1) -> [0, 0, 2, 1] -> (1, 0, 2, 1)
      novo_estado = list(estado)
      novo_estado[disco] = destino

      # Custo 1 por movimento (padrão)
      # após criar o novo estado, é adicionado na lista com o novo estado, o custo, e a acao
      saidas.append((tuple(novo_estado), 1, (disco, origem, destino)))

  return saidas


# ---------------------------------------------------------------------------
# HEURISTICA
# ---------------------------------------------------------------------------
# h(n) = quantidade de discos que ainda não estão no pino de destino.
#
# Relaxamento: apagamos a regra "nunca coloque um disco maior sobre um menor"
# E também a regra "só se move o disco do topo". Nesse mundo relaxado, cada
# disco fora do lugar é resolvido com exatamente um movimento, e o custo da
# solução relaxada e o número de discos fora do lugar.
#
# Admissível porque no problema real cada disco fora do lugar precisa ser
# movido pelo menos uma vez, então h(n) nunca passa do custo real.
# E uma heurística FRACA: h(n) vale no máximo n, enquanto a solução ótima
# custa 2^n - 1.
# A heurística é consultada muitas vezes por no, então guardamos o valor ja
# calculado de cada estado. É só uma otimização de desempenho: não muda o
# resultado da busca, apenas evita recontar os discos toda vez.
CACHE_DA_HEURISTICA = {}

# Verifica e adiciona os estados no cache da heuristica
def heuristica_discos_fora_do_lugar(estado):
  if estado in CACHE_DA_HEURISTICA:
    return CACHE_DA_HEURISTICA[estado]

  discos_fora = 0

  for pino_do_disco in estado:
    if pino_do_disco != PINO_DE_DESTINO:
      discos_fora += 1

  CACHE_DA_HEURISTICA[estado] = discos_fora
  return discos_fora

# Cria o problema a partir do número de discos
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
# (0, 0, 2, 1), (nó_pai), (mov para chegar no estado), (custo acumulado), (nesse caso, vai
# ser o mesmo do custo)
def criar_no(estado, pai, acao, custo, profundidade):
  return {
    "estado": estado,
    "pai": pai,
    "acao": acao,
    "custo": custo,
    "profundidade": profundidade
  }


# Remove o nó de menor f da fronteira, levando em consideração a heurística utilizada,
# depois de removido a busca continua a partir dele
def remover_menor_f(fronteira, f):
  indice_menor_f = 0
  menor_valor_de_f = f(fronteira[0])

  for i in range(1, len(fronteira)):
    valor_de_f = f(fronteira[i])

    if valor_de_f < menor_valor_de_f:
      indice_menor_f = i
      menor_valor_de_f = valor_de_f

  return fronteira.pop(indice_menor_f)

# Retorna a lista de estados e ações de um determinado nó até chegar no INICIAL
def caminho_ate(no):
  # Sobe pelos pais reconstruindo a sequência de estados e de ações.
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
  # Esta é a UNICA funcao de busca do trabalho.
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

# Busca de Custo Uniforme: olha só o custo já pago.
def f_ucs(no):
  return no["custo"]

# Busca Gulosa: olha só o palpite do que falta.
def f_gulosa(no):
  return heuristica_discos_fora_do_lugar(no["estado"])

# A*: soma o custo já pago com o palpite do que falta.
def f_a_estrela(no):
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
  # Mostra o conteúdo de cada pino, do disco maior (base) para o menor (topo).
  partes = []

  for pino in PINOS:
    discos = [disco + 1 for disco in range(len(estado)) if estado[disco] == pino]
    discos.reverse()
    partes.append("{}: {}".format(NOMES_DOS_PINOS[pino], discos))

  return "  |  ".join(partes)


def executar_comparacao(total_de_discos, limite_de_tempo=LIMITE_DE_TEMPO_EM_SEGUNDOS):
  # Roda os três algoritmos sobre o mesmo problema e devolve a lista de linhas.
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
