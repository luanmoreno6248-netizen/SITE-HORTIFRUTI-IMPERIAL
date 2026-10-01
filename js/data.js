/* =========================================================================
   HORTIFRUTI IMPERIAL — Dados da loja
   Nenhuma informação abaixo foi inventada: tudo veio do briefing oficial.
   ========================================================================= */

const LOJA = {
  nome: "Hortifruti Imperial",
  cidade: "Camamu - BA",
  endereco: "Rua Conselheiro Monteiro, Cidade Alta, Camamu-BA",
  enderecoCurto: "Rua Conselheiro Monteiro, Cidade Alta",
  whatsappVisivel: "(73) 99843-1375",
  whatsappNumero: "5573998431375",
  instagram: "@hortifrutiimperial01",
  instagramUrl: "https://www.instagram.com/hortifrutiimperial01/",
  horario: "7:30 às 20:00",
  entrega: "Sim",
  /* Formas de pagamento aceitas pelo Hortifruti Imperial.
     O cliente escolhe UMA delas no checkout (nada vem pré-selecionado). */
  pagamentos: ["Cartão de crédito", "Cartão de débito", "Pix", "Dinheiro"],
  pagamentoResumo: "Cartão de crédito, cartão de débito, Pix ou dinheiro"
};

/* Preços por KG exatamente como informados. `null` = "CONSULTAR".
   ----------------------------------------------------------------------
   COMPRA POR KG OU POR UNIDADE (como o site usa estes campos):
   - `preco`        → preço POR KG (é o preço informado pela loja).
   - `precoUnidade` → preço POR UNIDADE. Informe apenas quando existir
                      um valor fechado (ex.: precoUnidade: 2.50).
                      Enquanto não existir, o site mostra
                      "Preço por unidade a confirmar" e o valor é
                      confirmado no atendimento pelo WhatsApp.
                      O preço por KG NUNCA é convertido em preço por unidade.
   - `inteiro: true` → produtos que o cliente compra com facilidade
                      inteiros; a janela de compra já abre em "Por unidade". */
const PRODUTOS = [
  { id: 1,  nome: "Cebola branca",  preco: 8.90,  categoria: "Legumes", img: "cebola-branca"  },
  { id: 2,  nome: "Cebola roxa",    preco: 8.90,  categoria: "Legumes", img: "cebola-roxa"    },
  { id: 3,  nome: "Tomates",        preco: 7.90,  categoria: "Legumes", img: "tomates"        },
  { id: 4,  nome: "Pimentão",       preco: 7.90,  categoria: "Legumes", img: "pimentao"       },
  { id: 5,  nome: "Cenoura",        preco: 8.90,  categoria: "Legumes", img: "cenoura"        },
  { id: 6,  nome: "Batatinha",      preco: 10.90, categoria: "Legumes", img: "batatinha"      },
  { id: 7,  nome: "Batata doce",    preco: 6.90,  categoria: "Legumes", img: "batata-branca"  },
  { id: 8,  nome: "Uva roxa",       preco: 15.90, categoria: "Frutas",  img: "uva-roxa"       },
  { id: 9,  nome: "Uva verde",      preco: 15.90, categoria: "Frutas",  img: "uva-verde"      },
  { id: 10, nome: "Maçã",           preco: 11.99, categoria: "Frutas",  img: "maca",           inteiro: true },
  { id: 11, nome: "Pera",           preco: 14.90, categoria: "Frutas",  img: "pera",           inteiro: true },
  { id: 12, nome: "Abacaxi",        preco: 6.00,  categoria: "Frutas",  img: "abacaxi",        inteiro: true },
  { id: 13, nome: "Goiaba",         preco: 6.90,  categoria: "Frutas",  img: "goiaba",         inteiro: true },
  { id: 14, nome: "Mangas",         preco: 5.90,  categoria: "Frutas",  img: "mangas",         inteiro: true },
  { id: 15, nome: "Melão",          preco: 7.90,  categoria: "Frutas",  img: "melon",          inteiro: true },
  { id: 16, nome: "Abacate",        preco: 6.90,  categoria: "Frutas",  img: "abacate",        inteiro: true },
  { id: 17, nome: "Limão",          preco: 17.90, categoria: "Frutas",  img: "limao"          },
  { id: 18, nome: "Inhame",         preco: 7.90,  categoria: "Legumes", img: "inhame"         },
  { id: 19, nome: "Chuchu",         preco: 3.90,  categoria: "Legumes", img: "chuchu"         },
  { id: 20, nome: "Pepino",         preco: 3.99,  categoria: "Legumes", img: "pepino"         },
  { id: 21, nome: "Abóbora",        preco: 5.90,  categoria: "Legumes", img: "abobora"        },
  { id: 22, nome: "Quiabo",         preco: 12.90, categoria: "Legumes", img: "quiabo"         },
  { id: 23, nome: "Maracujá",       preco: 12.90, categoria: "Frutas",  img: "maracuja"       },
  { id: 24, nome: "Kiwi",           preco: 35.90, categoria: "Frutas",  img: "kiwi"           },
  { id: 25, nome: "Ameixa fresca",  preco: null,  categoria: "Frutas",  img: "ameixa-fresca"  },
  { id: 26, nome: "Morango",        preco: 13.90, categoria: "Frutas",  img: "morango"        },
  { id: 27, nome: "Pocam",          preco: 7.90,  categoria: "Frutas",  img: "pocam",          inteiro: true }
];

/* Etiquetas visuais da seção de ofertas.
   ATENÇÃO: apenas rótulos de destaque — NENHUM desconto foi inventado. */
const DESTAQUES = [
  { id: 12, etiqueta: "OFERTA" },
  { id: 19, etiqueta: "OFERTA" },
  { id: 20, etiqueta: "OFERTA" },
  { id: 14, etiqueta: "FRESQUINHO" },
  { id: 26, etiqueta: "FRESQUINHO" },
  { id: 24, etiqueta: "DESTAQUE" },
  { id: 3,  etiqueta: "DESTAQUE" },
  { id: 8,  etiqueta: "FRESQUINHO" }
];

const CATEGORIAS = [
  { chave: "Frutas",  rotulo: "FRUTAS",   icone: "🍎", img: "cat-frutas"   },
  { chave: "Verduras", rotulo: "VERDURAS", icone: "🥬", img: "cat-verduras" },
  { chave: "Legumes", rotulo: "LEGUMES",   icone: "🥕", img: "cat-legumes"  },
  { chave: "Temperos", rotulo: "TEMPEROS", icone: "🌿", img: "cat-temperos" }
];
