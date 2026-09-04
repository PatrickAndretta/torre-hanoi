// ---------------------------------------------------------------------------
// Interface da Torre de Hanoi.
//
// Este arquivo NAO implementa busca nenhuma. Ele so pede os resultados ao
// servidor Python (que chama a funcao unica de busca em hanoi.py), preenche a
// tabela de metricas e anima o caminho de estados devolvido.
// ---------------------------------------------------------------------------

const NOMES_DOS_PINOS = ["A", "B", "C"];

// Estado da tela.
const aplicacao = {
  discos: 3,
  resposta: null,        // resposta completa do servidor
  solucao: null,         // resultado do algoritmo escolhido para animar
  indiceDoPasso: 0,      // qual estado do caminho esta na tela
  indiceRenderizado: null, // qual estado o tabuleiro esta mostrando de fato
  tocando: false,
  temporizador: null
};

// Atalhos para os elementos da pagina.
const campoDiscos = document.getElementById("campo-discos");
const campoLimite = document.getElementById("campo-limite");
const campoVelocidade = document.getElementById("campo-velocidade");
const campoPasso = document.getElementById("campo-passo");
const botaoExecutar = document.getElementById("botao-executar");
const botaoInicio = document.getElementById("botao-inicio");
const botaoAnterior = document.getElementById("botao-anterior");
const botaoTocar = document.getElementById("botao-tocar");
const botaoProximo = document.getElementById("botao-proximo");
const corpoDaTabela = document.getElementById("corpo-da-tabela");
const avisoOtimo = document.getElementById("aviso-otimo");
const avisoStatus = document.getElementById("aviso-status");
const legendaJogada = document.getElementById("legenda-jogada");
const tabuleiro = document.getElementById("tabuleiro");
const secaoDaAnimacao = document.getElementById("secao-animacao");
const botaoTelaCheia = document.getElementById("botao-tela-cheia");

// ---------------------------------------------------------------------------
// Comunicacao com o servidor
// ---------------------------------------------------------------------------

async function executarBuscas() {
  const discos = Number(campoDiscos.value);
  const limite = Number(campoLimite.value);

  pararAnimacao();
  botaoExecutar.disabled = true;
  avisoStatus.className = "aviso trabalhando";
  avisoStatus.textContent =
    "Executando UCS, Gulosa e A* com " + discos + " discos. " +
    "Com muitos discos a UCS pode demorar; aguarde ate o limite de " + limite + " s.";

  try {
    const endereco = "/api/buscar?discos=" + discos + "&limite=" + limite;
    const resposta = await fetch(endereco);
    const dados = await resposta.json();

    if (dados.erro) {
      avisoStatus.className = "aviso erro";
      avisoStatus.textContent = "Erro: " + dados.erro;
      return;
    }

    aplicacao.discos = dados.discos;
    aplicacao.resposta = dados;

    avisoOtimo.innerHTML =
      "Solucao otima conhecida por formula: 2<sup>" + dados.discos + "</sup> &minus; 1 = " +
      dados.otimo + " movimentos.";

    preencherTabela(dados);

    // Escolhe automaticamente a primeira solucao concluida para animar.
    const primeiraConcluida = dados.resultados.find(function (linha) {
      return linha.concluiu;
    });

    if (primeiraConcluida) {
      selecionarSolucao(primeiraConcluida.algoritmo);
      avisoStatus.className = "aviso";
      avisoStatus.textContent = "Buscas concluidas.";
    } else {
      avisoStatus.className = "aviso erro";
      avisoStatus.textContent = "Nenhuma busca concluiu dentro do limite de tempo.";
      desenharTabuleiroVazio(dados.discos);
    }
  } catch (erro) {
    avisoStatus.className = "aviso erro";
    avisoStatus.textContent = "Falha ao falar com o servidor: " + erro.message;
  } finally {
    botaoExecutar.disabled = false;
  }
}

// ---------------------------------------------------------------------------
// Tabela de resultados
// ---------------------------------------------------------------------------

function preencherTabela(dados) {
  corpoDaTabela.innerHTML = "";

  // Menor numero de nos expandidos entre as buscas que concluiram.
  const concluidas = dados.resultados.filter(function (linha) { return linha.concluiu; });
  const menorExpandidos = concluidas.length
    ? Math.min.apply(null, concluidas.map(function (linha) { return linha.expandidos; }))
    : null;

  dados.resultados.forEach(function (linha) {
    const tr = document.createElement("tr");
    tr.dataset.algoritmo = linha.algoritmo;

    const custo = linha.concluiu ? String(linha.custo) : "-";
    const passos = linha.concluiu ? String(linha.passos) : "-";
    const tempo = linha.concluiu
      ? linha.tempo.toFixed(4)
      : "<span class='nao-concluiu'>nao concluiu em " + dados.limite + "s</span>";

    // Marca se a solucao bateu com o otimo conhecido (2^n - 1) ou ficou pior.
    let marcaDoCusto = "";
    if (linha.concluiu && linha.custo === dados.otimo) {
      marcaDoCusto = "<span class='marca-otimo'>otimo</span>";
    } else if (linha.concluiu) {
      const excesso = linha.custo - dados.otimo;
      marcaDoCusto = "<span class='marca-pior'>+" + excesso + "</span>";
    }

    const marcaExpandidos =
      linha.concluiu && linha.expandidos === menorExpandidos
        ? "<span class='marca-otimo'>menor</span>"
        : "";

    const botao = linha.concluiu
      ? "<button class='botao' data-animar='" + linha.algoritmo + "'>Animar</button>"
      : "-";

    tr.innerHTML =
      "<td>" + linha.algoritmo + "</td>" +
      "<td>" + linha.heuristica + "</td>" +
      "<td>" + custo + marcaDoCusto + "</td>" +
      "<td>" + passos + "</td>" +
      "<td>" + linha.expandidos + marcaExpandidos + "</td>" +
      "<td>" + tempo + "</td>" +
      "<td>" + botao + "</td>";

    corpoDaTabela.appendChild(tr);
  });
}

function selecionarSolucao(nomeDoAlgoritmo) {
  const linha = aplicacao.resposta.resultados.find(function (item) {
    return item.algoritmo === nomeDoAlgoritmo && item.concluiu;
  });

  if (!linha) {
    return;
  }

  pararAnimacao();

  aplicacao.solucao = linha;
  aplicacao.indiceDoPasso = 0;
  aplicacao.indiceRenderizado = null;

  campoPasso.max = String(linha.caminho.length - 1);
  campoPasso.value = "0";

  // Destaca a linha escolhida na tabela.
  Array.prototype.forEach.call(corpoDaTabela.children, function (tr) {
    tr.classList.toggle("selecionada", tr.dataset.algoritmo === nomeDoAlgoritmo);
  });

  desenharPasso(false);
}

// ---------------------------------------------------------------------------
// Desenho do tabuleiro em 3D
// ---------------------------------------------------------------------------
// A cena inteira e montada com transformacoes 3D do proprio CSS. O chao e o
// plano XY do elemento .cena; depois do rotateX aplicado nele, o eixo Z do CSS
// passa a ser a vertical do mundo. Entao empilhar disco e so somar translateZ.
//
// Os discos sao criados UMA vez e depois so mudam de transform. E por isso que
// eles conseguem andar de um pino ao outro: se a cada jogada a gente apagasse
// e redesenhasse tudo, o disco apareceria direto no destino (teleporte).

// Medidas da cena, em pixels (ajustadas pela largura real do tabuleiro).
const GEOMETRIA = {
  alturaDaHaste: 200,
  raioDaBase: 96,
  diametroMinimo: 54,
  diametroMaximo: 168,
  posicoesDosPinos: [18, 50, 82],  // porcentagem da largura da cena
  larguraDeReferencia: 900,
  alturaDeReferencia: 470,         // altura do tabuleiro fora da tela cheia
  escalaMaximaEmTelaCheia: 2,
  folgaDeVoo: 28                   // quanto o disco sobe acima do topo da haste
};

// Angulos da camera. O arrasto do mouse mexe nestes dois numeros.
const CAMERA_INICIAL = { inclinacao: 62, giro: 0 };
const camera = { inclinacao: CAMERA_INICIAL.inclinacao, giro: CAMERA_INICIAL.giro };

// Cena montada no momento, com as referencias dos elementos de cada disco.
let cenaAtual = null;

function limitar(valor, minimo, maximo) {
  return Math.max(minimo, Math.min(maximo, valor));
}

function suavizar(fracao) {
  // Smoothstep: comeca e termina devagar. Usada para o disco nao dar solavanco.
  const u = limitar(fracao, 0, 1);
  return u * u * (3 - 2 * u);
}

function aplicarCamera() {
  tabuleiro.style.setProperty("--inclinacao", camera.inclinacao + "deg");
  tabuleiro.style.setProperty("--giro", camera.giro + "deg");

  // Um texto deitado no chao encolhe por cos(inclinacao) na tela. Guardamos o
  // inverso para os rotulos desfazerem esse achatamento com scaleY.
  const cosseno = Math.cos((camera.inclinacao * Math.PI) / 180);
  tabuleiro.style.setProperty("--compensacao", (1 / Math.max(cosseno, 0.26)).toFixed(2));
}

function emTelaCheia() {
  return document.fullscreenElement === secaoDaAnimacao;
}

function escalaDaCena() {
  // Em telas estreitas a cena encolhe; em tela cheia ela cresce. Os dois
  // limites (largura e altura) entram na conta para nada sair do quadro.
  const largura = tabuleiro.clientWidth || GEOMETRIA.larguraDeReferencia;
  const altura = tabuleiro.clientHeight || GEOMETRIA.alturaDeReferencia;
  const limite = emTelaCheia() ? GEOMETRIA.escalaMaximaEmTelaCheia : 1;

  return Math.min(
    limite,
    largura / GEOMETRIA.larguraDeReferencia,
    altura / GEOMETRIA.alturaDeReferencia
  );
}

function diametroDoDisco(disco, totalDeDiscos, escala) {
  // O menor disco (indice 0) fica estreito e cresce conforme o indice.
  const minimo = GEOMETRIA.diametroMinimo;
  const maximo = GEOMETRIA.diametroMaximo;
  const fatia = totalDeDiscos > 1 ? (maximo - minimo) / (totalDeDiscos - 1) : 0;
  return (minimo + fatia * disco) * escala;
}

function espessuraDoDisco(totalDeDiscos) {
  // Todos os discos precisam caber na haste, entao quanto mais discos, mais
  // fino cada um fica.
  const disponivel = GEOMETRIA.alturaDaHaste - 26;
  return limitar(disponivel / totalDeDiscos, 7, 20);
}

function corDaFatia(disco, totalDeDiscos, fracao) {
  // fracao 0 = fatia da base (escura), fracao 1 = fatia do topo (clara).
  const matiz = Math.round((360 / Math.max(totalDeDiscos, 1)) * disco);
  const luminosidade = Math.round(34 + 30 * fracao);
  return "hsl(" + matiz + ", 70%, " + luminosidade + "%)";
}

// ------------------------------ pecas fixas --------------------------------

function criarSombra(escala) {
  const sombra = document.createElement("div");
  sombra.className = "sombra-do-pino";

  const diametro = GEOMETRIA.raioDaBase * 2.2 * escala;
  sombra.style.width = diametro + "px";
  sombra.style.height = diametro + "px";
  sombra.style.transform = "translate(-50%, -50%) translateZ(1px)";
  return sombra;
}

function criarBase(escala) {
  const base = document.createElement("div");
  base.className = "base-do-pino";

  const diametro = GEOMETRIA.raioDaBase * 2 * escala;
  base.style.width = diametro + "px";
  base.style.height = diametro + "px";
  base.style.transform = "translate(-50%, -50%) translateZ(2px)";
  return base;
}

function criarHaste(escala) {
  // Duas placas verticais cruzadas. De qualquer angulo da camera uma delas
  // aparece de frente, entao o conjunto le como uma haste cilindrica.
  const altura = GEOMETRIA.alturaDaHaste * escala;
  const pecas = [];

  [0, 90].forEach(function (giroDaPlaca) {
    const placa = document.createElement("div");
    placa.className = "haste";
    placa.style.height = altura + "px";
    placa.style.transform =
      "translate(-50%, -50%) translateZ(" + (altura / 2) + "px) " +
      "rotateX(90deg) rotateY(" + giroDaPlaca + "deg)";
    pecas.push(placa);
  });

  const topo = document.createElement("div");
  topo.className = "topo-da-haste";
  topo.style.transform = "translate(-50%, -50%) translateZ(" + altura + "px)";
  pecas.push(topo);

  return pecas;
}

function criarRotulo(nome, escala) {
  const rotulo = document.createElement("span");
  rotulo.className = "rotulo-do-pino";
  rotulo.textContent = nome;

  // Fica deitado no chao, na frente da base, e desfaz o giro e o achatamento
  // da camera para continuar legivel.
  const distancia = GEOMETRIA.raioDaBase * escala + 26;
  rotulo.style.transform =
    "translate(-50%, -50%) translateY(" + distancia + "px) translateZ(3px) " +
    "rotateZ(calc(-1 * var(--giro, 0deg))) scaleY(var(--compensacao, 2.1))";

  return rotulo;
}

function criarDisco(disco, totalDeDiscos, espessura, escala) {
  // O grupo .disco e o que se move; as fatias dentro dele so dao a espessura.
  const grupo = document.createElement("div");
  grupo.className = "disco";

  const diametro = diametroDoDisco(disco, totalDeDiscos, escala);
  const totalDeFatias = Math.max(3, Math.round(espessura / 3));
  const passo = (espessura * escala) / totalDeFatias;

  for (let i = 0; i < totalDeFatias; i++) {
    const fracao = totalDeFatias > 1 ? i / (totalDeFatias - 1) : 1;

    const fatia = document.createElement("div");
    fatia.className = "fatia";
    fatia.style.width = diametro + "px";
    fatia.style.height = diametro + "px";
    fatia.style.background = corDaFatia(disco, totalDeDiscos, fracao);
    fatia.style.transform = "translate(-50%, -50%) translateZ(" + (i * passo) + "px)";

    // O numero do disco fica impresso na fatia de cima. Ele sai do centro
    // porque o centro e justamente onde a haste passa e taparia o texto.
    if (i === totalDeFatias - 1) {
      fatia.classList.add("fatia-do-topo");

      const numero = document.createElement("span");
      numero.className = "numero-do-disco";
      numero.textContent = String(disco + 1);
      numero.style.transform =
        "translate(-50%, -50%) translateY(" + (diametro * 0.31) + "px) " +
        "rotateZ(calc(-1 * var(--giro, 0deg))) scaleY(var(--compensacao, 2.1))";
      fatia.appendChild(numero);
    }

    grupo.appendChild(fatia);
  }

  return grupo;
}

// ------------------------------ montagem -----------------------------------

function montarCena(totalDeDiscos) {
  const escala = escalaDaCena();

  tabuleiro.innerHTML = "";

  const cena = document.createElement("div");
  cena.className = "cena";

  // Empurra a cena para baixo para as pilhas altas caberem no topo do quadro.
  const alturaDoQuadro = tabuleiro.clientHeight || GEOMETRIA.alturaDeReferencia;
  cena.style.setProperty("--recuo", (alturaDoQuadro * 0.2).toFixed(1) + "px");

  const piso = document.createElement("div");
  piso.className = "piso";
  cena.appendChild(piso);

  for (let pino = 0; pino < 3; pino++) {
    const divPino = document.createElement("div");
    divPino.className = "pino";
    divPino.style.left = GEOMETRIA.posicoesDosPinos[pino] + "%";

    divPino.appendChild(criarSombra(escala));
    divPino.appendChild(criarBase(escala));

    criarHaste(escala).forEach(function (peca) {
      divPino.appendChild(peca);
    });

    divPino.appendChild(criarRotulo(NOMES_DOS_PINOS[pino], escala));
    cena.appendChild(divPino);
  }

  // Os discos ficam numa camada propria, ancorada no centro da cena. Como
  // todos tem o mesmo pai, andar de um pino ao outro e so mudar o translateX.
  const camada = document.createElement("div");
  camada.className = "camada-de-discos";

  const espessura = espessuraDoDisco(totalDeDiscos);
  const elementos = [];

  for (let disco = 0; disco < totalDeDiscos; disco++) {
    const grupo = criarDisco(disco, totalDeDiscos, espessura, escala);
    camada.appendChild(grupo);
    elementos.push(grupo);
  }

  cena.appendChild(camada);
  tabuleiro.appendChild(cena);

  cenaAtual = {
    total: totalDeDiscos,
    escala: escala,
    espessura: espessura,
    largura: tabuleiro.clientWidth || GEOMETRIA.larguraDeReferencia,
    elementos: elementos
  };
}

// ------------------------------ posicoes -----------------------------------

function posicaoDoPino(pino) {
  // Converte a posicao em porcentagem para pixels a partir do centro da cena.
  const fracao = GEOMETRIA.posicoesDosPinos[pino] / 100 - 0.5;
  return cenaAtual.largura * fracao;
}

function alturaDoNivel(nivel) {
  return 4 + nivel * cenaAtual.espessura * cenaAtual.escala;
}

function alturaDeVoo() {
  return GEOMETRIA.alturaDaHaste * cenaAtual.escala + GEOMETRIA.folgaDeVoo;
}

function transformacaoDoDisco(x, z) {
  return "translate3d(" + x + "px, 0px, " + z + "px)";
}

function posicoesDoEstado(estado) {
  // Para cada disco, em que pino ele esta e em que nivel da pilha.
  const posicoes = new Array(estado.length);

  for (let pino = 0; pino < 3; pino++) {
    let nivel = 0;

    // Do MAIOR para o menor: essa e a ordem de empilhamento, com o maior
    // disco na base (nivel 0).
    for (let disco = estado.length - 1; disco >= 0; disco--) {
      if (estado[disco] === pino) {
        posicoes[disco] = { pino: pino, nivel: nivel };
        nivel += 1;
      }
    }
  }

  return posicoes;
}

function posicionarDiscos(estado, discoDestacado) {
  const posicoes = posicoesDoEstado(estado);

  cenaAtual.elementos.forEach(function (grupo, disco) {
    const lugar = posicoes[disco];

    grupo.style.transform = transformacaoDoDisco(
      posicaoDoPino(lugar.pino),
      alturaDoNivel(lugar.nivel)
    );
    grupo.classList.toggle("movido", disco === discoDestacado);
  });
}

// ------------------------------ animacao -----------------------------------

function duracaoDaJogada() {
  // A jogada tem que terminar antes de a proxima comecar, senao as animacoes
  // se atropelam quando a velocidade esta bem rapida.
  const intervalo = Math.max(60, Number(campoVelocidade.value) || 450);
  return limitar(intervalo * 0.85, 110, 900);
}

function animarMovimento(estadoAnterior, estadoNovo, jogada) {
  const disco = jogada[0];
  const origem = jogada[1];
  const destino = jogada[2];

  const grupo = cenaAtual.elementos[disco];

  const xOrigem = posicaoDoPino(origem);
  const xDestino = posicaoDoPino(destino);
  const zOrigem = alturaDoNivel(posicoesDoEstado(estadoAnterior)[disco].nivel);
  const zDestino = alturaDoNivel(posicoesDoEstado(estadoNovo)[disco].nivel);
  const zVoo = alturaDeVoo();

  // Todo mundo ja vai para a posicao final; so este disco e que faz o trajeto.
  // Como a animacao nao usa fill, ao terminar ele para exatamente no destino.
  posicionarDiscos(estadoNovo, disco);

  // Trajeto em tres tempos: sobe acima da haste, atravessa e desce. As faixas
  // de subida (0 a 0.34) e de travessia (0.28 a 0.72) se sobrepoem de proposito,
  // para o canto do caminho sair arredondado em vez de quadrado.
  const quadros = [];
  const totalDeQuadros = 24;

  for (let i = 0; i <= totalDeQuadros; i++) {
    const t = i / totalDeQuadros;

    const avanco = suavizar((t - 0.28) / 0.44);
    const x = xOrigem + (xDestino - xOrigem) * avanco;

    let z;
    if (t < 0.34) {
      z = zOrigem + (zVoo - zOrigem) * suavizar(t / 0.34);
    } else if (t > 0.66) {
      z = zVoo + (zDestino - zVoo) * suavizar((t - 0.66) / 0.34);
    } else {
      z = zVoo;
    }

    quadros.push({ transform: transformacaoDoDisco(x, z), offset: t });
  }

  // Cancela um voo anterior que ainda esteja no ar (velocidade muito rapida).
  grupo.getAnimations().forEach(function (animacao) {
    animacao.cancel();
  });

  grupo.animate(quadros, { duration: duracaoDaJogada(), easing: "linear" });
}

// ------------------------------ desenho ------------------------------------

function desenharTabuleiroVazio(totalDeDiscos) {
  montarCena(totalDeDiscos);
  posicionarDiscos(new Array(totalDeDiscos).fill(0), null);
  aplicacao.indiceRenderizado = null;
}

function desenharPasso(animar) {
  if (!aplicacao.solucao) {
    return;
  }

  const indice = aplicacao.indiceDoPasso;
  const estado = aplicacao.solucao.caminho[indice];
  const anterior = aplicacao.indiceRenderizado;

  // Se a cena nao existe ou e de outro numero de discos, remonta e nao anima.
  if (!cenaAtual || cenaAtual.total !== estado.length) {
    montarCena(estado.length);
    animar = false;
  }

  // So anima quando o salto e de exatamente uma jogada. Arrastar a barra de
  // progresso pula varios passos de uma vez e ai a posicao e direta.
  const umaJogada = anterior !== null && Math.abs(indice - anterior) === 1;

  if (animar && umaJogada) {
    const paraFrente = indice > anterior;

    // A acao de indice i leva do estado i para o estado i+1. Voltando, e a
    // mesma acao com origem e destino trocados.
    const acao = paraFrente
      ? aplicacao.solucao.acoes[anterior]
      : aplicacao.solucao.acoes[indice];

    const jogada = paraFrente
      ? acao
      : [acao[0], acao[2], acao[1]];

    animarMovimento(aplicacao.solucao.caminho[anterior], estado, jogada);
  } else {
    const discoMovido = indice > 0 ? aplicacao.solucao.acoes[indice - 1][0] : null;
    posicionarDiscos(estado, discoMovido);
  }

  aplicacao.indiceRenderizado = indice;
  campoPasso.value = String(indice);

  const total = aplicacao.solucao.caminho.length - 1;

  if (indice === 0) {
    legendaJogada.textContent =
      aplicacao.solucao.algoritmo + " - estado inicial (0 de " + total + " jogadas).";
  } else {
    legendaJogada.textContent =
      aplicacao.solucao.algoritmo + " - jogada " + indice + " de " + total + ": " +
      aplicacao.solucao.descricoes[indice - 1] + ".";
  }
}

// ---------------------------------------------------------------------------
// Controles da animacao
// ---------------------------------------------------------------------------

function irParaPasso(indice, animar) {
  if (!aplicacao.solucao) {
    return;
  }

  const ultimo = aplicacao.solucao.caminho.length - 1;
  aplicacao.indiceDoPasso = Math.max(0, Math.min(indice, ultimo));
  desenharPasso(animar);
}

function tocarOuPausar() {
  if (!aplicacao.solucao) {
    return;
  }

  if (aplicacao.tocando) {
    pararAnimacao();
    return;
  }

  // Se estiver no fim, recomeca do inicio.
  if (aplicacao.indiceDoPasso >= aplicacao.solucao.caminho.length - 1) {
    aplicacao.indiceDoPasso = 0;
    desenharPasso(false);
  }

  aplicacao.tocando = true;
  botaoTocar.innerHTML = "&#10073;&#10073; Pausar";

  const intervalo = Math.max(60, Number(campoVelocidade.value) || 450);

  aplicacao.temporizador = setInterval(function () {
    if (aplicacao.indiceDoPasso >= aplicacao.solucao.caminho.length - 1) {
      pararAnimacao();
      return;
    }

    aplicacao.indiceDoPasso += 1;
    desenharPasso(true);
  }, intervalo);
}

function pararAnimacao() {
  if (aplicacao.temporizador !== null) {
    clearInterval(aplicacao.temporizador);
    aplicacao.temporizador = null;
  }

  aplicacao.tocando = false;
  botaoTocar.innerHTML = "&#9654; Tocar";
}

// ---------------------------------------------------------------------------
// Ligacao dos eventos
// ---------------------------------------------------------------------------

botaoExecutar.addEventListener("click", executarBuscas);
botaoInicio.addEventListener("click", function () { pararAnimacao(); irParaPasso(0, false); });
botaoAnterior.addEventListener("click", function () { pararAnimacao(); irParaPasso(aplicacao.indiceDoPasso - 1, true); });
botaoProximo.addEventListener("click", function () { pararAnimacao(); irParaPasso(aplicacao.indiceDoPasso + 1, true); });
botaoTocar.addEventListener("click", tocarOuPausar);

campoPasso.addEventListener("input", function () {
  pararAnimacao();
  irParaPasso(Number(campoPasso.value), false);
});

// Clique no botao "Animar" de qualquer linha da tabela.
corpoDaTabela.addEventListener("click", function (evento) {
  const alvo = evento.target;
  if (alvo && alvo.dataset && alvo.dataset.animar) {
    selecionarSolucao(alvo.dataset.animar);
  }
});

// ---------------------------------------------------------------------------
// Tela cheia (modo apresentacao)
// ---------------------------------------------------------------------------
// Vai para tela cheia a SECAO inteira, e nao so o tabuleiro, para os botoes de
// jogada e a legenda continuarem visiveis durante o seminario.

function atualizarBotaoDeTelaCheia() {
  botaoTelaCheia.innerHTML = emTelaCheia()
    ? "&#9974; Sair da tela cheia"
    : "&#9974; Tela cheia";
}

function alternarTelaCheia() {
  if (emTelaCheia()) {
    document.exitFullscreen();
    return;
  }

  const pedido = secaoDaAnimacao.requestFullscreen();

  // Se o navegador recusar (permissao, iframe), avisa em vez de falhar calado.
  if (pedido && pedido.catch) {
    pedido.catch(function (erro) {
      avisoStatus.className = "aviso erro";
      avisoStatus.textContent = "Nao foi possivel entrar em tela cheia: " + erro.message;
    });
  }
}

botaoTelaCheia.addEventListener("click", alternarTelaCheia);

// Entrar e sair muda o tamanho do quadro, entao a cena e remontada na escala
// nova. Vale tambem quando o usuario sai apertando Esc.
document.addEventListener("fullscreenchange", function () {
  atualizarBotaoDeTelaCheia();
  redesenhar();
});

// Atalhos de teclado. So valem em tela cheia, senao atrapalhariam quem esta
// digitando nos campos de numero de discos e de velocidade.
document.addEventListener("keydown", function (evento) {
  if (!emTelaCheia() || !aplicacao.solucao) {
    return;
  }

  if (evento.key === "ArrowRight" || evento.key === "PageDown") {
    pararAnimacao();
    irParaPasso(aplicacao.indiceDoPasso + 1, true);
  } else if (evento.key === "ArrowLeft" || evento.key === "PageUp") {
    pararAnimacao();
    irParaPasso(aplicacao.indiceDoPasso - 1, true);
  } else if (evento.key === " ") {
    tocarOuPausar();
  } else if (evento.key === "Home") {
    pararAnimacao();
    irParaPasso(0, false);
  } else {
    return;
  }

  evento.preventDefault();
});

// Arrastar o tabuleiro gira a camera da cena 3D.
let arrasto = null;

tabuleiro.addEventListener("pointerdown", function (evento) {
  arrasto = {
    x: evento.clientX,
    y: evento.clientY,
    inclinacao: camera.inclinacao,
    giro: camera.giro
  };

  tabuleiro.classList.add("arrastando");
  tabuleiro.setPointerCapture(evento.pointerId);
});

tabuleiro.addEventListener("pointermove", function (evento) {
  if (!arrasto) {
    return;
  }

  camera.giro = limitar(arrasto.giro + (evento.clientX - arrasto.x) * 0.25, -55, 55);
  camera.inclinacao = limitar(arrasto.inclinacao + (evento.clientY - arrasto.y) * 0.2, 18, 84);
  aplicarCamera();
});

function encerrarArrasto() {
  arrasto = null;
  tabuleiro.classList.remove("arrastando");
}

tabuleiro.addEventListener("pointerup", encerrarArrasto);
tabuleiro.addEventListener("pointercancel", encerrarArrasto);

// Clique duplo volta a camera para o angulo inicial.
tabuleiro.addEventListener("dblclick", function () {
  camera.inclinacao = CAMERA_INICIAL.inclinacao;
  camera.giro = CAMERA_INICIAL.giro;
  aplicarCamera();
});

// Ao mudar a largura da janela a cena inteira muda de escala, entao redesenha.
function redesenhar() {
  if (aplicacao.solucao) {
    montarCena(aplicacao.solucao.caminho[0].length);
    aplicacao.indiceRenderizado = null;
    desenharPasso(false);
  } else {
    desenharTabuleiroVazio(Number(campoDiscos.value));
  }
}

window.addEventListener("resize", redesenhar);

// Desenha a torre inicial assim que a pagina abre.
atualizarBotaoDeTelaCheia();
aplicarCamera();
desenharTabuleiroVazio(Number(campoDiscos.value));

campoDiscos.addEventListener("change", function () {
  pararAnimacao();
  aplicacao.solucao = null;
  legendaJogada.textContent = "Execute uma busca e escolha um algoritmo na tabela.";
  desenharTabuleiroVazio(Number(campoDiscos.value));
});
