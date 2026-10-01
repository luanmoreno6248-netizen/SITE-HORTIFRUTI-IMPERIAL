/* =========================================================================
   HORTIFRUTI IMPERIAL — Lógica da loja
   Busca, filtros, carrinho e envio do pedido pelo WhatsApp.
   ========================================================================= */
(function () {
  "use strict";

  /* ------------------------------ UTIL ------------------------------ */
  const $ = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => Array.prototype.slice.call((ctx || document).querySelectorAll(sel));

  const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  const fmt = (v) => brl.format(v).replace(/\u00A0/g, " ");

  const semAcento = (s) =>
    String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  const WA_URL = "https://wa.me/" + LOJA.whatsappNumero;

  const ETIQUETAS = { OFERTA: "oferta", DESTAQUE: "destaque", FRESQUINHO: "fresquinho" };
  const etiquetaDe = (id) => {
    const d = DESTAQUES.find((x) => x.id === id);
    return d ? d.etiqueta : null;
  };
  const porId = (id) => PRODUTOS.find((p) => p.id === id);

  /* =====================================================================
     COMPRA POR KG OU POR UNIDADE
     - O preço do catálogo (`p.preco`) é o preço POR KG.
     - Preço por unidade só existe quando `p.precoUnidade` está preenchido
       em data.js; sem ele, mostramos "Preço por unidade a confirmar" e o
       valor é confirmado no atendimento pelo WhatsApp.
     - O preço por KG nunca é convertido em preço por unidade.
     ===================================================================== */
  const TIPO_KG = "kg";
  const TIPO_UN = "un";
  const PASSO_KG = 0.25;      /* passo dos botões − / + em KG */

  const ehKg = (item) => item.tipo !== TIPO_UN;
  const ehInteiro = (p) => p.inteiro === true;
  const precoUnidade = (p) => (p.precoUnidade == null ? null : p.precoUnidade);

  function precoUnitario(p, tipo) {
    return tipo === TIPO_UN ? precoUnidade(p) : p.preco;
  }

  /* aceita "1,5" e "1.5" */
  function parseQtd(txt) {
    const n = parseFloat(String(txt == null ? "" : txt).replace(/\s+/g, "").replace(",", "."));
    return isFinite(n) ? n : NaN;
  }
  const arred = (n) => Math.round(n * 100) / 100;

  /* valida e normaliza a quantidade de cada tipo */
  function normQtd(n, tipo) {
    if (!isFinite(n) || n <= 0) return null;
    if (tipo === TIPO_UN) return Math.max(1, Math.round(n));
    const kg = arred(n);
    return kg > 0 ? kg : null;
  }

  const fmtQtd = (n) => String(arred(n)).replace(".", ",");

  function rotuloQtd(n, tipo) {
    if (tipo === TIPO_UN) {
      const u = Math.round(n);
      return u + " " + (u === 1 ? "unidade" : "unidades");
    }
    return fmtQtd(n) + " KG";
  }

  function rotuloPreco(p, tipo) {
    const pu = precoUnitario(p, tipo);
    if (pu === null) return tipo === TIPO_UN ? "Preço por unidade a confirmar" : "Preço a confirmar";
    return tipo === TIPO_UN ? fmt(pu) + "/unidade" : fmt(pu) + "/KG";
  }

  /* ------------------------------ ESTADO ------------------------------ */
  const CHAVE = "hortifruti_imperial_pedido_v1";
  let carrinho = [];   /* [{ id, tipo: "kg" | "un", qtd }] — 1 linha por produto */
  let pagamento = null; /* forma de pagamento escolhida no checkout (null = ainda não escolhida) */
  let filtroCat = "Todos";
  let termoBusca = "";

  /* formas aceitas (fonte única: js/data.js) */
  const PAGAMENTOS = (LOJA.pagamentos && LOJA.pagamentos.length)
    ? LOJA.pagamentos.slice()
    : ["Cartão de crédito", "Cartão de débito", "Pix", "Dinheiro"];

  function normalizarItens(dados) {
    const bruto = Array.isArray(dados) ? dados : (dados && Array.isArray(dados.itens) ? dados.itens : null);
    if (!bruto) return [];
    /* compatibilidade com pedidos salvos antes da compra por KG/unidade */
    const vistos = {};
    return bruto
      .filter((i) => i && porId(i.id) && Number(i.qtd) > 0)
      .map((i) => ({
        id: i.id,
        tipo: i.tipo === TIPO_UN ? TIPO_UN : TIPO_KG,
        qtd: Number(i.qtd)
      }))
      .filter((i) => {
        if (vistos[i.id]) return false;
        vistos[i.id] = true;
        return true;
      });
  }

  function carregar() {
    try {
      const bruto = localStorage.getItem(CHAVE);
      if (!bruto) return;
      const dados = JSON.parse(bruto);
      carrinho = normalizarItens(dados);
      /* escolha de pagamento registrada no pedido */
      pagamento = (!Array.isArray(dados) && typeof dados.pagamento === "string" &&
                   PAGAMENTOS.indexOf(dados.pagamento) !== -1)
        ? dados.pagamento
        : null;
    } catch (e) {
      carrinho = [];
      pagamento = null;
    }
  }
  function salvar() {
    try {
      localStorage.setItem(CHAVE, JSON.stringify({ itens: carrinho, pagamento: pagamento }));
    } catch (e) { /* modo privado: ignora */ }
  }

  /* ------------------------------ TOAST ------------------------------ */
  const toastEl = $("#toast");
  let toastTimer = null;
  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("is-visible"), 2600);
  }

  /* ------------------------------ CATEGORIAS ------------------------------ */
  function renderCategorias() {
    const grid = $("#catGrid");
    if (!grid) return;
    grid.innerHTML = CATEGORIAS.map((c) => {
      const qtd = PRODUTOS.filter((p) => p.categoria === c.chave).length;
      return `
        <button type="button" class="cat-card reveal" data-cat="${c.chave}">
          <img src="assets/products/${c.img}.jpg" alt="Categoria ${c.rotulo.toLowerCase()} do Hortifruti Imperial" loading="lazy">
          <span class="cat-card__body">
            <span class="cat-card__ico">${c.icone}</span>
            <span class="cat-card__name">${c.rotulo}</span>
            ${qtd > 0 ? `<span class="cat-card__count">${qtd} ${qtd === 1 ? "produto" : "produtos"}</span>` : ""}
          </span>
        </button>`;
    }).join("");

    $$(".cat-card", grid).forEach((btn) => {
      btn.addEventListener("click", () => {
        aplicarFiltro(btn.dataset.cat, true);
      });
    });
  }

  /* ------------------------------ PRODUTOS ------------------------------ */
  function listaFiltrada() {
    const t = semAcento(termoBusca.trim());
    return PRODUTOS.filter((p) => {
      const okCat = filtroCat === "Todos" || p.categoria === filtroCat;
      const okBusca = !t || semAcento(p.nome).indexOf(t) !== -1 || semAcento(p.categoria).indexOf(t) !== -1;
      return okCat && okBusca;
    });
  }

  function cardProduto(p) {
    const et = etiquetaDe(p.id);
    const cls = et ? " card__tag--" + ETIQUETAS[et] : "";
    const tag = et ? `<span class="card__tag${cls}">${et}</span>` : "";
    const preco = p.preco === null
      ? `<div class="card__price card__price--consult">CONSULTAR<small>Preço no WhatsApp</small></div>`
      : `<div class="card__price">${fmt(p.preco)}<small>por KG</small></div>`;

    return `
      <article class="card reveal" data-id="${p.id}">
        <div class="card__media">
          <img src="assets/products/${p.img}.jpg" alt="${p.nome} — Hortifruti Imperial" loading="lazy" width="400" height="300">
          ${tag}
        </div>
        <div class="card__body">
          <span class="card__cat">${p.categoria.toUpperCase()}</span>
          <h3 class="card__name">${p.nome}</h3>
          ${preco}
          <div class="card__foot">
            <button type="button" class="add-btn" data-add="${p.id}">ADICIONAR AO PEDIDO</button>
          </div>
        </div>
      </article>`;
  }

  function renderProdutos() {
    const grid = $("#prodGrid");
    const vazio = $("#emptyState");
    const cont = $("#resultsCount");
    if (!grid) return;

    const lista = listaFiltrada();
    grid.innerHTML = lista.map(cardProduto).join("");

    if (vazio) {
      vazio.hidden = lista.length !== 0;
      const msg = $("#emptyMsg");
      if (msg) {
        if (termoBusca.trim()) {
          msg.textContent = `Nenhum produto encontrado para "${termoBusca.trim()}".`;
        } else if (filtroCat !== "Todos") {
          msg.textContent = `Nenhum produto da categoria ${filtroCat.toUpperCase()} no momento. Veja todos os itens disponíveis.`;
        } else {
          msg.textContent = "Tente outro termo ou veja todos os produtos.";
        }
      }
    }

    if (cont) {
      if (lista.length === 0) cont.textContent = "";
      else if (termoBusca.trim() || filtroCat !== "Todos") {
        cont.textContent = `${lista.length} ${lista.length === 1 ? "produto encontrado" : "produtos encontrados"}`;
      } else {
        cont.textContent = `${lista.length} produtos disponíveis`;
      }
    }

    observarReveal(grid);
    ligarBotoesAdicionar(grid);
    revelarVisiveis();
  }

  function renderOfertas() {
    const grid = $("#offerGrid");
    if (!grid) return;
    const itens = DESTAQUES.map((d) => porId(d.id)).filter(Boolean);
    grid.innerHTML = itens.map((p) => {
      const et = etiquetaDe(p.id);
      const preco = p.preco === null
        ? `<div class="card__price card__price--consult">CONSULTAR</div>`
        : `<div class="card__price">${fmt(p.preco)}<small>por KG</small></div>`;
      return `
        <article class="offer-card reveal" data-id="${p.id}">
          <div class="card__media">
            <img src="assets/products/${p.img}.jpg" alt="${p.nome} — Hortifruti Imperial" loading="lazy" width="400" height="300">
            <span class="card__tag card__tag--${ETIQUETAS[et]}">${et}</span>
          </div>
          <div class="card__body">
            <span class="card__cat">${p.categoria.toUpperCase()}</span>
            <h3 class="card__name">${p.nome}</h3>
            <div class="offer-card__price-row">${preco}</div>
            <div class="card__foot">
              <button type="button" class="add-btn add-btn--lime" data-add="${p.id}">ADICIONAR AO PEDIDO</button>
            </div>
          </div>
        </article>`;
    }).join("");
    observarReveal(grid);
    ligarBotoesAdicionar(grid);
    revelarVisiveis();
  }

  /* ------------------------------ BUSCA / FILTRO ------------------------------ */
  function aplicarFiltro(cat, rolar) {
    filtroCat = cat;
    $$("#filters .chip").forEach((c) => c.classList.toggle("is-active", c.dataset.cat === cat));
    renderProdutos();
    if (rolar) {
      const alvo = $("#produtos");
      if (alvo) alvo.scrollIntoView({ behavior: "smooth", block: "start" });
      if (cat !== "Todos") toast("Categoria " + cat.toUpperCase() + " selecionada");
    }
  }

  function resetFiltros() {
    termoBusca = "";
    const inp = $("#searchInput");
    if (inp) inp.value = "";
    const clr = $("#searchClear");
    if (clr) clr.hidden = true;
    aplicarFiltro("Todos", false);
  }

  /* ------------------------------ CARRINHO ------------------------------ */
  function itensComQtd() {
    return carrinho
      .map((i) => ({ p: porId(i.id), qtd: i.qtd, tipo: i.tipo }))
      .filter((x) => x.p && x.qtd > 0);
  }
  /* número de produtos distintos no pedido (KG e unidade não se somam) */
  function totalItens() {
    return itensComQtd().length;
  }
  /* subtotal em CENTAVOS INTEIROS: o total do pedido é sempre
     a soma exata dos subtotais que o cliente vê na tela (sem
     diferença de 1 centavo por causa de ponto flutuante). */
  function subtotal(p, tipo, qtd) {
    const pu = precoUnitario(p, tipo);
    if (pu === null) return null;
    return Math.round(Math.round(pu * 100) * qtd) / 100;
  }
  function totalGeral() {
    const cents = itensComQtd().reduce((s, x) => {
      const st = subtotal(x.p, x.tipo, x.qtd);
      return st === null ? s : s + Math.round(st * 100);
    }, 0);
    return cents / 100;
  }
  function temSemPreco() {
    return itensComQtd().some((x) => subtotal(x.p, x.tipo, x.qtd) === null);
  }

  /* adiciona (ou atualiza) o produto no pedido com o tipo escolhido */
  function adicionar(id, tipo, qtd) {
    const p = porId(id);
    if (!p) return false;
    const q = normQtd(qtd, tipo);
    if (!q) return false;

    let ex = carrinho.find((i) => i.id === id);
    if (ex) {
      if (ex.tipo === tipo) ex.qtd = normQtd(ex.qtd + q, tipo);
      else { ex.tipo = tipo; ex.qtd = q; }      /* trocou KG ⇄ unidade */
    } else {
      ex = { id: id, tipo: tipo, qtd: q };
      carrinho.push(ex);
    }
    salvar();
    renderCarrinho();
    toast(`Adicionado ao pedido: ${rotuloQtd(ex.qtd, tipo)} de ${p.nome}`);
    return true;
  }

  /* botões − / + */
  function alterar(id, delta) {
    const it = carrinho.find((i) => i.id === id);
    if (!it) return;
    const passo = ehKg(it) ? PASSO_KG : 1;
    const bruto = arred(it.qtd + delta * passo);
    if (bruto <= 0) { remover(id); return; }
    const q = normQtd(bruto, it.tipo);
    if (!q) { remover(id); return; }
    it.qtd = q;
    salvar();
    atualizarLinha(id);          /* atualiza a linha no lugar (não recria a lista) */
  }

  /* quantidade digitada pelo cliente */
  function definirQtd(id, valor) {
    const it = carrinho.find((i) => i.id === id);
    if (!it) return;
    const n = typeof valor === "number" ? valor : parseQtd(valor);
    const q = normQtd(n, it.tipo);
    if (!q) { atualizarLinha(id); return; }   /* valor inválido: volta ao anterior */
    it.qtd = q;
    salvar();
    atualizarLinha(id);          /* atualiza a linha no lugar (não recria a lista) */
  }

  function remover(id) {
    const p = porId(id);
    carrinho = carrinho.filter((i) => i.id !== id);
    salvar();
    renderCarrinho();
    if (p) toast(`${p.nome} removido do pedido`);
  }

  function limpar() {
    carrinho = [];
    pagamento = null;
    salvar();
    renderCarrinho();
    toast("Pedido limpo");
  }

  function linhaCarrinho({ p, qtd, tipo }) {
    const pu = precoUnitario(p, tipo);
    const st = subtotal(p, tipo, qtd);
    const porUnidade = tipo === TIPO_UN;
    return `
        <li class="cart-item" data-id="${p.id}">
          <img class="cart-item__img" src="assets/products/${p.img}.jpg" alt="${p.nome}" loading="lazy">
          <div>
            <div class="cart-item__top">
              <div class="cart-item__name">${p.nome}</div>
              <button type="button" class="cart-item__remove" data-remove="${p.id}">REMOVER</button>
            </div>

            <div class="cart-item__info">
              <span class="cart-item__badge${porUnidade ? " cart-item__badge--un" : ""}">${porUnidade ? "Por unidade" : "Por KG"}</span>
              <span class="cart-item__price${pu === null ? " is-pending" : ""}">${rotuloPreco(p, tipo)}</span>
            </div>

            <div class="cart-item__bottom">
              <div class="qty">
                <button type="button" data-dec="${p.id}" aria-label="Diminuir quantidade de ${p.nome}">−</button>
                <input class="qty__input" type="text" inputmode="decimal" autocomplete="off" value="${fmtQtd(qtd)}" data-qtd="${p.id}" aria-label="Quantidade de ${p.nome} em ${porUnidade ? "unidades" : "KG"}">
                <span class="qty__unit">${porUnidade ? (qtd === 1 ? "unidade" : "unidades") : "KG"}</span>
                <button type="button" data-inc="${p.id}" aria-label="Aumentar quantidade de ${p.nome}">+</button>
              </div>
              <div class="cart-item__sub${st === null ? " is-pending" : ""}">Subtotal: ${st === null ? "a confirmar" : fmt(st)}</div>
            </div>
          </div>
        </li>`;
  }

  function renderCarrinho() {
    const list = $("#cartList");
    if (!list) return;
    list.innerHTML = itensComQtd().map(linhaCarrinho).join("");
    atualizarResumo();
  }

  /* só o rodapé/resumo do pedido (badge, contagem, total, pagamento, nota) */
  function atualizarResumo() {
    const empty = $("#cartEmpty");
    const foot = $("#cartFoot");
    const badge = $("#cartBadge");
    const itens = itensComQtd();

    if (empty) empty.hidden = itens.length > 0;
    if (foot) foot.hidden = itens.length === 0;

    const totalQtd = totalItens();
    if (badge) {
      badge.textContent = totalQtd > 99 ? "99+" : String(totalQtd);
      badge.hidden = totalQtd === 0;
    }

    const cCount = $("#cartCount");
    if (cCount) cCount.textContent = `${totalQtd} ${totalQtd === 1 ? "item" : "itens"}`;

    const total = totalGeral();
    const cTotal = $("#cartTotal");
    if (cTotal) cTotal.textContent = (total === 0 && temSemPreco()) ? "a combinar" : fmt(total);

    /* forma de pagamento escolhida (registrada no pedido) */
    const cPay = $("#cartPay");
    if (cPay) {
      cPay.textContent = pagamento || "escolher no checkout";
      cPay.classList.toggle("is-pending", !pagamento);
    }

    const nota = $("#cartNote");
    if (nota) {
      if (temSemPreco()) {
        nota.hidden = false;
        nota.textContent = "Há itens com preço a confirmar: o valor será combinado pelo Hortifruti Imperial no WhatsApp.";
      } else {
        nota.hidden = true;
      }
    }
  }

  /* Atualiza APENAS a linha do produto alterado, sem recriar a lista.
     Assim o campo e os botões continuam no lugar: dá para digitar a
     quantidade e clicar em − / + / REMOVER sem perder o clique. */
  function atualizarLinha(id) {
    const it = carrinho.find((i) => i.id === id);
    const p = it ? porId(id) : null;
    const li = document.querySelector('#cartList .cart-item[data-id="' + id + '"]');
    if (!it || !p || !li) { renderCarrinho(); return; }

    const pu = precoUnitario(p, it.tipo);
    const st = subtotal(p, it.tipo, it.qtd);
    const porUnidade = it.tipo === TIPO_UN;

    const b = li.querySelector(".cart-item__badge");
    if (b) {
      b.textContent = porUnidade ? "Por unidade" : "Por KG";
      b.classList.toggle("cart-item__badge--un", porUnidade);
    }

    const preco = li.querySelector(".cart-item__price");
    if (preco) {
      preco.textContent = rotuloPreco(p, it.tipo);
      preco.classList.toggle("is-pending", pu === null);
    }

    const inp = li.querySelector(".qty__input");
    if (inp) {
      inp.value = fmtQtd(it.qtd);
      inp.setAttribute("value", fmtQtd(it.qtd));   /* mantém o HTML do campo coerente */
      inp.setAttribute("aria-label", "Quantidade de " + p.nome + " em " + (porUnidade ? "unidades" : "KG"));
    }

    const un = li.querySelector(".qty__unit");
    if (un) un.textContent = porUnidade ? (it.qtd === 1 ? "unidade" : "unidades") : "KG";

    const sub = li.querySelector(".cart-item__sub");
    if (sub) {
      sub.textContent = "Subtotal: " + (st === null ? "a confirmar" : fmt(st));
      sub.classList.toggle("is-pending", st === null);
    }

    atualizarResumo();
  }

  /* ------------------------------ COMO DESEJA COMPRAR (KG / UNIDADE) ------------------------------ */
  const choice = $("#choice");
  let escolha = { id: null, tipo: TIPO_KG, qtd: 1, btn: null };
  let focoAnterior = null;
  let choiceTimer = null;

  const CHIPS_KG = [0.5, 0.75, 1, 1.5, 2, 3, 5];
  const CHIPS_UN = [1, 2, 3, 4, 5, 10];

  function abrirEscolha(id, btn) {
    const p = porId(id);
    if (!p || !choice) return;

    escolha = {
      id: id,
      tipo: ehInteiro(p) ? TIPO_UN : TIPO_KG,   /* produtos inteiros já abrem por unidade */
      qtd: 1,
      btn: btn || null
    };

    const img = $("#choiceImg");
    if (img) {
      img.src = "assets/products/" + p.img + ".jpg";
      img.alt = p.nome + " — Hortifruti Imperial";
    }
    const nome = $("#choiceName");
    if (nome) nome.textContent = p.nome;

    const info = $("#choicePrice");
    if (info) {
      const linhaKG = p.preco === null ? "Por KG: CONSULTAR" : "Por KG: " + fmt(p.preco);
      const pu = precoUnidade(p);
      const linhaUN = pu === null ? "Por unidade: preço a confirmar" : "Por unidade: " + fmt(pu);
      info.textContent = linhaKG + " · " + linhaUN;
    }

    if (choice.hidden) focoAnterior = document.activeElement;   /* guarda o foco original só na 1ª abertura */
    choice.hidden = false;
    void choice.offsetWidth;             /* reflow para animar */
    choice.classList.add("is-open");
    document.body.classList.add("no-scroll");

    atualizarEscolha();
    clearTimeout(choiceTimer);
    choiceTimer = setTimeout(() => {
      const ativo = $(".type-btn.is-active", choice) || $("#choiceTypes");
      if (ativo) ativo.focus();
    }, 60);
  }

  function fecharEscolha() {
    if (!choice || choice.hidden) return;
    choice.classList.remove("is-open");
    clearTimeout(choiceTimer);
    choiceTimer = setTimeout(() => {
      if (!choice.classList.contains("is-open")) choice.hidden = true;
    }, 260);
    if (!document.querySelector(".cart.is-open")) document.body.classList.remove("no-scroll");
    if (focoAnterior && typeof focoAnterior.focus === "function") focoAnterior.focus();
    focoAnterior = null;
  }

  function atualizarEscolha() {
    if (!choice || choice.hidden || escolha.id == null) return;
    const p = porId(escolha.id);
    if (!p) return;
    const porUnidade = escolha.tipo === TIPO_UN;

    /* botões de tipo */
    $$(".type-btn", choice).forEach((b) => {
      const on = b.dataset.tipo === escolha.tipo;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-pressed", String(on));
    });

    /* rótulo + unidade */
    const label = $("#choiceQtyLabel");
    if (label) label.textContent = porUnidade ? "Quantidade de unidades" : "Quantidade em KG";
    const unit = $("#choiceUnit");
    if (unit) unit.textContent = porUnidade ? "un." : "KG";
    const inp = $("#choiceQtd");
    if (inp) {
      inp.value = fmtQtd(escolha.qtd);
      inp.setAttribute("value", fmtQtd(escolha.qtd));   /* mantém o HTML do campo coerente */
      inp.setAttribute("aria-label", "Quantidade de " + p.nome + " em " + (porUnidade ? "unidades" : "KG"));
    }

    /* sugestões rápidas */
    const chips = $("#choiceChips");
    if (chips) {
      const opcoes = porUnidade ? CHIPS_UN : CHIPS_KG;
      chips.innerHTML = opcoes
        .map((v) => `<button type="button" class="chip-sm${v === escolha.qtd ? " is-active" : ""}" data-chip="${v}">${fmtQtd(v)}</button>`)
        .join("");
    }

    /* total calculado automaticamente: preço × quantidade
       (mesmo cálculo do subtotal que vai para o carrinho) */
    const pu = precoUnitario(p, escolha.tipo);
    const st = subtotal(p, escolha.tipo, escolha.qtd);
    const total = $("#choiceTotal");
    if (total) {
      if (pu === null || st === null) {
        total.textContent = "A confirmar";
        total.classList.add("is-pending");
      } else {
        total.textContent = fmt(st);
        total.classList.remove("is-pending");
      }
    }

    /* aviso de preço a confirmar */
    const hint = $("#choiceHint");
    if (hint) {
      if (pu === null) {
        hint.hidden = false;
        hint.textContent = porUnidade
          ? "Preço por unidade a confirmar — o valor será combinado no atendimento pelo WhatsApp."
          : "Preço por KG a confirmar — o valor será combinado no atendimento pelo WhatsApp.";
      } else {
        hint.hidden = true;
      }
    }
  }

  function definirTipoEscolha(tipo) {
    if (!escolha.id) return;
    escolha.tipo = tipo === TIPO_UN ? TIPO_UN : TIPO_KG;
    escolha.qtd = normQtd(escolha.qtd, escolha.tipo) || 1;  /* mantém a qtd se fizer sentido */
    atualizarEscolha();
  }

  function mudarQtdEscolha(delta) {
    const passo = escolha.tipo === TIPO_UN ? 1 : PASSO_KG;
    const bruto = arred(escolha.qtd + delta * passo);
    const q = normQtd(bruto, escolha.tipo);
    if (!q) return;
    escolha.qtd = q;
    atualizarEscolha();
  }

  function confirmarEscolha() {
    if (escolha.id == null) return;
    /* confirma com o valor que está NO CAMPO (mesmo sem ter saído dele) */
    const campo = $("#choiceQtd");
    if (campo) {
      const qCampo = normQtd(parseQtd(campo.value), escolha.tipo);
      if (qCampo) escolha.qtd = qCampo;
    }
    const id = escolha.id;
    const tipo = escolha.tipo;
    const qtd = escolha.qtd;
    if (adicionar(id, tipo, qtd)) {
      const btn = escolha.btn;
      fecharEscolha();
      if (btn && document.contains(btn)) feedbackAdicionado(btn);
    }
  }

  /* ------------------------------ WHATSAPP ------------------------------ */
  function montarMensagem() {
    const itens = itensComQtd();

    const linhas = itens.map(({ p, qtd, tipo }) => {
      const st = subtotal(p, tipo, qtd);
      const valor = st === null ? "valor a confirmar" : fmt(st);
      return `- ${rotuloQtd(qtd, tipo)} de ${p.nome} — ${valor}`;
    });

    /* total: soma do que já tem preço + o que falta confirmar */
    const total = totalGeral();
    const semPreco = temSemPreco();
    let totalTxt;
    if (!semPreco) totalTxt = fmt(total);
    else if (total > 0) totalTxt = fmt(total) + " + valor a confirmar";
    else totalTxt = "valor a confirmar";

    const bloco = [
      "HORTIFRUTI IMPERIAL - NOVO PEDIDO",
      "",
      "Produtos:",
      linhas.length ? linhas.join("\n") : "- Nenhum item selecionado",
      "",
      "Total:",
      totalTxt,
      "",
      "Forma de pagamento:",
      pagamento || "a combinar"
    ];

    if (semPreco) {
      const faltaUnidade = itens.some((x) => x.tipo === TIPO_UN && precoUnidade(x.p) === null);
      const faltaKg = itens.some((x) => x.tipo === TIPO_KG && x.p.preco === null);
      bloco.push("");
      if (faltaUnidade) bloco.push("Valor da unidade será confirmado pelo Hortifruti Imperial.");
      if (faltaKg) bloco.push("Preço por KG será confirmado pelo Hortifruti Imperial.");
    }

    bloco.push(
      "",
      "Entrega: " + LOJA.entrega,
      "Endereço: enviar no WhatsApp para confirmar",
      "",
      "Aguardo confirmação, obrigado(a)!"
    );

    return bloco.join("\n");
  }

  /* ------------------------------ CHECKOUT: COMO DESEJA PAGAR? ------------------------------ */
  const checkout = $("#checkout");
  let focoAnteriorCheckout = null;
  let checkoutTimer = null;

  function abrirCheckout() {
    if (!checkout) return;
    if (carrinho.length === 0) {
      toast("Adicione produtos ao pedido primeiro");
      abrirCarrinho();
      return;
    }

    /* NENHUMA opção vem selecionada: o cliente escolhe de forma explícita */
    $$(".pay-check", checkout).forEach((c) => { c.checked = false; });
    sincronizarOpcoesPagamento();
    const erro = $("#payError");
    if (erro) erro.hidden = true;

    const tot = $("#payTotal");
    if (tot) {
      const total = totalGeral();
      if (!temSemPreco()) tot.textContent = "Total do pedido: " + fmt(total);
      else if (total > 0) tot.textContent = "Total: " + fmt(total) + " + valor a confirmar";
      else tot.textContent = "Total: valor a confirmar";
    }

    if (checkout.hidden) focoAnteriorCheckout = document.activeElement;  /* guarda o foco original só na 1ª abertura */
    checkout.hidden = false;
    void checkout.offsetWidth;            /* reflow para animar */
    checkout.classList.add("is-open");
    document.body.classList.add("no-scroll");

    clearTimeout(checkoutTimer);
    checkoutTimer = setTimeout(() => {
      const primeiro = $(".pay-check", checkout);
      if (primeiro) primeiro.focus();
    }, 60);
  }

  function fecharCheckout() {
    if (!checkout || checkout.hidden) return;
    checkout.classList.remove("is-open");
    clearTimeout(checkoutTimer);
    checkoutTimer = setTimeout(() => {
      if (!checkout.classList.contains("is-open")) checkout.hidden = true;
    }, 260);
    if (!document.querySelector(".cart.is-open")) document.body.classList.remove("no-scroll");
    if (focoAnteriorCheckout && typeof focoAnteriorCheckout.focus === "function") focoAnteriorCheckout.focus();
    focoAnteriorCheckout = null;
  }

  function formaPagamentoSelecionada() {
    if (!checkout) return null;
    const marcado = $$(".pay-check", checkout).filter((c) => c.checked)[0];
    return marcado ? marcado.value : null;
  }

  /* espelha a escolha nas opções e no rodapé do carrinho (registro do pedido) */
  function sincronizarOpcoesPagamento() {
    if (checkout) {
      $$(".pay-option", checkout).forEach((label) => {
        const cb = $(".pay-check", label);
        label.classList.toggle("is-checked", !!(cb && cb.checked));
      });
    }
    const cPay = $("#cartPay");
    if (cPay) {
      cPay.textContent = pagamento || "escolher no checkout";
      cPay.classList.toggle("is-pending", !pagamento);
    }
  }

  function confirmarPagamento() {
    /* validação: produtos no carrinho + forma de pagamento escolhida */
    if (carrinho.length === 0) {
      fecharCheckout();
      toast("Adicione produtos ao pedido primeiro");
      abrirCarrinho();
      return;
    }
    const escolhido = formaPagamentoSelecionada();
    if (!escolhido) {
      const erro = $("#payError");
      if (erro) {
        erro.hidden = false;
        try { erro.scrollIntoView({ block: "nearest" }); } catch (e) { /* ok */ }
      }
      const primeiro = $$(".pay-check", checkout)[0];
      if (primeiro) primeiro.focus();
      return;
    }

    pagamento = escolhido;
    salvar();
    sincronizarOpcoesPagamento();

    const texto = montarMensagem();
    window.open(WA_URL + "?text=" + encodeURIComponent(texto), "_blank", "noopener,noreferrer");
    toast("Pedido enviado — pagamento: " + pagamento);
    fecharCheckout();
  }

  /* o botão do carrinho abre o checkout (escolha de pagamento) */
  function enviarPedido() {
    abrirCheckout();
  }

  /* ------------------------------ ABRIR/FECHAR CARRINHO ------------------------------ */
  const cart = $("#cart");
  const overlay = $("#overlay");

  function abrirCarrinho() {
    if (!cart) return;
    cart.removeAttribute("inert");
    cart.classList.add("is-open");
    cart.setAttribute("aria-hidden", "false");
    if (overlay) {
      overlay.hidden = false;
      void overlay.offsetWidth; /* força reflow para animar */
      overlay.classList.add("is-open");
    }
    document.body.classList.add("no-scroll");
    const fechar = $("#closeCart");
    if (fechar) fechar.focus();
  }
  function fecharCarrinho() {
    if (!cart) return;
    cart.classList.remove("is-open");
    cart.setAttribute("aria-hidden", "true");
    cart.setAttribute("inert", "");
    if (overlay) {
      overlay.classList.remove("is-open");
      setTimeout(() => { if (!cart.classList.contains("is-open")) overlay.hidden = true; }, 320);
    }
    document.body.classList.remove("no-scroll");
  }

  /* ------------------------------ MENU MOBILE ------------------------------ */
  function fecharMenu() {
    const nav = $("#nav");
    const ham = $("#hamburger");
    if (nav) nav.classList.remove("is-open");
    if (ham) { ham.classList.remove("is-open"); ham.setAttribute("aria-expanded", "false"); ham.setAttribute("aria-label", "Abrir menu"); }
  }

  /* ------------------------------ REVEAL ------------------------------ */
  let observer = null;
  function iniciarObserver() {
    if (!("IntersectionObserver" in window)) return;
    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("is-visible");
            observer.unobserve(e.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -40px 0px" }
    );
  }
  function observarReveal(ctx) {
    const els = $$(".reveal", ctx || document);
    if (!observer) {
      els.forEach((el) => el.classList.add("is-visible"));
      return;
    }
    els.forEach((el) => {
      if (!el.classList.contains("is-visible")) observer.observe(el);
    });
  }

  /* Fallback que NÃO depende do IntersectionObserver: garante que nada
     do conteúdo fique invisível mesmo com o observador não disparando. */
  function revelarVisiveis() {
    const vh = window.innerHeight || 0;
    if (!vh) return;
    $$(".reveal:not(.is-visible)").forEach((el) => {
      const r = el.getBoundingClientRect();
      /* Revela tudo que já passou ou está na tela — assim nenhum bloco
         fica invisível mesmo com rolagens rápidas ou saltos de âncora. */
      if (r.top < vh) el.classList.add("is-visible");
    });
  }

  /* ------------------------------ SCROLL SPY ------------------------------ */
  function atualizarNav() {
    const links = $$(".nav__link");
    if (!links.length) return;
    const alvoY = window.scrollY + (window.innerHeight * 0.35);
    let atual = null;
    $$("main section[id]").forEach((s) => {
      if (s.offsetTop <= alvoY) atual = s.id;
    });
    links.forEach((l) => l.classList.toggle("is-active", l.getAttribute("href") === "#" + atual));
  }

  function aoRolar() {
    const header = $("#header");
    if (header) header.classList.toggle("is-scrolled", window.scrollY > 12);
    revelarVisiveis();
    atualizarNav();
  }

  /* ------------------------------ ADICIONAR (delegação) ------------------------------ */
  function feedbackAdicionado(btn) {
    const original = "ADICIONAR AO PEDIDO";
    btn.classList.add("is-added");
    btn.textContent = "ADICIONADO ✓";
    clearTimeout(btn._t);
    btn._t = setTimeout(() => {
      btn.classList.remove("is-added");
      btn.textContent = original;
    }, 1400);
  }

  function ligarBotoesAdicionar(ctx) {
    $$("[data-add]", ctx).forEach((btn) => {
      /* abre a janela "Como deseja comprar?" (KG ou unidade) */
      btn.addEventListener("click", () => abrirEscolha(Number(btn.dataset.add), btn));
    });
  }

  /* ------------------------------ INICIALIZAÇÃO ------------------------------ */
  function init() {
    iniciarObserver();
    carregar();

    renderCategorias();
    renderProdutos();
    renderOfertas();
    renderCarrinho();
    observarReveal(document);
    revelarVisiveis();
    atualizarNav();
    setTimeout(revelarVisiveis, 400);
    setTimeout(revelarVisiveis, 1500);

    /* Vigia: garante conteúdo visível mesmo quando o navegador
       engarrafou eventos de rolagem (aba em segundo plano) e mantém
       header/scroll-spy sempre atualizados, mesmo sem evento novo. */
    setInterval(aoRolar, 350);

    const ano = $("#year");
    if (ano) ano.textContent = String(new Date().getFullYear());

    /* busca */
    const inp = $("#searchInput");
    const clr = $("#searchClear");
    if (inp) {
      inp.addEventListener("input", () => {
        termoBusca = inp.value;
        if (clr) clr.hidden = inp.value.length === 0;
        renderProdutos();
      });
    }
    if (clr && inp) {
      clr.addEventListener("click", () => {
        inp.value = "";
        termoBusca = "";
        clr.hidden = true;
        inp.focus();
        renderProdutos();
      });
    }

    /* filtros */
    $$("#filters .chip").forEach((c) => {
      c.addEventListener("click", () => aplicarFiltro(c.dataset.cat, false));
    });
    const reset = $("#resetFilters");
    if (reset) reset.addEventListener("click", resetFiltros);

    /* carrinho */
    $("#openCart").addEventListener("click", abrirCarrinho);
    $("#closeCart").addEventListener("click", fecharCarrinho);
    if (overlay) overlay.addEventListener("click", fecharCarrinho);

    const shop = $("#cartShop");
    if (shop) shop.addEventListener("click", () => {
      fecharCarrinho();
      const alvo = $("#produtos");
      if (alvo) alvo.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    $("#clearCart").addEventListener("click", () => {
      if (carrinho.length === 0) { toast("Seu pedido já está vazio"); return; }
      if (window.confirm("Remover todos os itens do pedido?")) limpar();
    });

    $("#sendOrder").addEventListener("click", enviarPedido);

    /* checkout: forma de pagamento (nada vem selecionado) */
    if (checkout) {
      $$(".pay-check", checkout).forEach((cb) => {
        cb.addEventListener("change", () => {
          if (cb.checked) {
            /* apenas UMA forma de pagamento por pedido */
            $$(".pay-check", checkout).forEach((o) => { if (o !== cb) o.checked = false; });
            pagamento = cb.value;
          } else {
            pagamento = null;
          }
          salvar();
          sincronizarOpcoesPagamento();
          const erro = $("#payError");
          if (erro && pagamento) erro.hidden = true;
        });
      });
      $("#paySend").addEventListener("click", confirmarPagamento);
      $("#payClose").addEventListener("click", fecharCheckout);
      $("#payBack").addEventListener("click", fecharCheckout);
      $$(".checkout [data-checkout-close]").forEach((el) => el.addEventListener("click", fecharCheckout));
    }

    $("#cartList").addEventListener("click", (ev) => {
      const alvo = ev.target.closest("[data-inc],[data-dec],[data-remove]");
      if (!alvo) return;
      if (alvo.hasAttribute("data-inc")) alterar(Number(alvo.dataset.inc), 1);
      else if (alvo.hasAttribute("data-dec")) alterar(Number(alvo.dataset.dec), -1);
      else if (alvo.hasAttribute("data-remove")) remover(Number(alvo.dataset.remove));
    });

    /* quantidade digitada no carrinho (digita e sai do campo) */
    $("#cartList").addEventListener("change", (ev) => {
      const campo = ev.target.closest("[data-qtd]");
      if (campo) definirQtd(Number(campo.dataset.qtd), campo.value);
    });

    /* Enter confirma a quantidade digitada (não depende de sair do campo) */
    $("#cartList").addEventListener("keydown", (ev) => {
      const campo = ev.target.closest && ev.target.closest("[data-qtd]");
      if (!campo || ev.key !== "Enter") return;
      ev.preventDefault();
      definirQtd(Number(campo.dataset.qtd), campo.value);   /* aplica o digitado */
      if (campo.isConnected) campo.blur();
    });

    /* ---------------- janela "Como deseja comprar?" (KG ou unidade) --------------- */
    if (choice) {
      $("#choiceTypes").addEventListener("click", (ev) => {
        const btn = ev.target.closest(".type-btn");
        if (btn) definirTipoEscolha(btn.dataset.tipo);
      });

      $("#choiceChips").addEventListener("click", (ev) => {
        const chip = ev.target.closest("[data-chip]");
        if (!chip) return;
        const q = normQtd(parseQtd(chip.dataset.chip), escolha.tipo);
        if (q) { escolha.qtd = q; atualizarEscolha(); }
      });

      $("#choiceInc").addEventListener("click", () => mudarQtdEscolha(1));
      $("#choiceDec").addEventListener("click", () => mudarQtdEscolha(-1));

      $("#choiceQtd").addEventListener("change", (ev) => {
        const q = normQtd(parseQtd(ev.target.value), escolha.tipo);
        escolha.qtd = q || escolha.qtd;
        atualizarEscolha();
      });

      /* total automático enquanto o cliente digita (só atualiza a tela:
         não mexe no texto que está sendo digitado) */
      $("#choiceQtd").addEventListener("input", (ev) => {
        if (escolha.id == null) return;
        const p = porId(escolha.id);
        const total = $("#choiceTotal");
        if (!p || !total) return;
        const q = normQtd(parseQtd(ev.target.value), escolha.tipo);
        if (!q) return;                       /* incompleto/inválido: mantém o total */
        escolha.qtd = q;                      /* estado sempre igual ao que está na tela */
        const st = subtotal(p, escolha.tipo, q);
        if (st === null) return;              /* preço a confirmar: já está na tela */
        total.textContent = fmt(st);
        total.classList.remove("is-pending");
      });

      /* Enter confirma COM a quantidade digitada (sem esperar o campo sair) */
      $("#choiceQtd").addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") {
          ev.preventDefault();
          const q = normQtd(parseQtd(ev.target.value), escolha.tipo);
          if (q) escolha.qtd = q;
          confirmarEscolha();
        }
      });

      $("#choiceAdd").addEventListener("click", confirmarEscolha);
      $("#choiceClose").addEventListener("click", fecharEscolha);
      $$(".choice [data-choice-close]").forEach((el) => el.addEventListener("click", fecharEscolha));
    }

    /* menu mobile */
    const ham = $("#hamburger");
    const nav = $("#nav");
    if (ham && nav) {
      ham.addEventListener("click", () => {
        const aberto = nav.classList.toggle("is-open");
        ham.classList.toggle("is-open", aberto);
        ham.setAttribute("aria-expanded", String(aberto));
        ham.setAttribute("aria-label", aberto ? "Fechar menu" : "Abrir menu");
      });
      $$("#nav a").forEach((a) => a.addEventListener("click", fecharMenu));
    }

    /* header sombra + estado da rolagem (síncrono: não depende de rAF) */
    let ultimoUpdate = 0;
    window.addEventListener("scroll", () => {
      const agora = Date.now();
      if (agora - ultimoUpdate < 80) return;
      ultimoUpdate = agora;
      aoRolar();
    }, { passive: true });

    document.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape") {
        if (checkout && !checkout.hidden) { fecharCheckout(); return; }
        if (choice && !choice.hidden) { fecharEscolha(); return; }
        fecharCarrinho();
        fecharMenu();
      }
    });

    /* fecha o menu ao redimensionar para desktop */
    window.addEventListener("resize", () => {
      if (window.innerWidth > 900) fecharMenu();
      revelarVisiveis();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
