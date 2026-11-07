/* Carrosséis contínuos (empresas e trabalhos) */
function createMarquee(root, opts = {}) {
  const track = root.querySelector('.marquee__track');
  const originals = [...track.children];
  const speed = Number(root.dataset.speed) || 40;      // px por segundo
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let setW = 0, x = 0, pending = 0, paused = false, last = performance.now();
  let rate = 1;   // 1 = velocidade normal, 0 = parado; muda aos poucos para frear/acelerar com suavidade

  function build() {
    track.querySelectorAll('[data-clone]').forEach(n => n.remove());
    const first = originals[0], lastEl = originals[originals.length - 1];
    const mr = parseFloat(getComputedStyle(lastEl).marginRight) || 0;
    setW = lastEl.offsetLeft + lastEl.offsetWidth + mr - first.offsetLeft;
    if (!setW) return;
    const copies = Math.ceil(root.offsetWidth / setW) + 1;
    for (let c = 0; c < copies; c++) {
      originals.forEach(el => {
        const k = el.cloneNode(true);
        k.setAttribute('data-clone', '');
        k.setAttribute('aria-hidden', 'true');
        k.querySelectorAll('a,button').forEach(a => a.tabIndex = -1);
        track.appendChild(k);
      });
    }
  }

  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05); last = now;
    rate += ((paused || reduce ? 0 : 1) - rate) * Math.min(1, dt * 4);   // desacelera ao passar o mouse e retoma devagar ao sair
    if (rate < 0.001) rate = 0;
    x += speed * rate * dt;
    const step = pending * 0.12; pending -= step; x += step;
    if (Math.abs(pending) < 0.1) pending = 0;
    if (setW) x = ((x % setW) + setW) % setW;
    track.style.transform = `translate3d(${-x}px,0,0)`;
    requestAnimationFrame(frame);
  }

  build();
  addEventListener('load', build);
  new ResizeObserver(build).observe(root);
  requestAnimationFrame(frame);

  root.addEventListener('mouseenter', () => paused = true);
  root.addEventListener('mouseleave', () => paused = false);
  root.addEventListener('focusin', () => paused = true);
  root.addEventListener('focusout', () => paused = false);
  root.addEventListener('touchstart', () => paused = true, { passive: true });
  root.addEventListener('touchend', () => setTimeout(() => paused = false, 1200), { passive: true });

  return {
    nudge(dir) {
      const card = originals[0];
      const mr = parseFloat(getComputedStyle(card).marginRight) || 0;
      pending += dir * (card.offsetWidth + mr);
    }
  };
}

document.querySelectorAll('.marquee').forEach(el => {
  const m = createMarquee(el);
  if (el.classList.contains('marquee--works')) {
    document.getElementById('next')?.addEventListener('click', () => m.nudge(1));
    document.getElementById('prev')?.addEventListener('click', () => m.nudge(-1));
  }
});

/* Destaque do item ativo do menu ao rolar */
const links = [...document.querySelectorAll('.nav a')];
const map = links.filter(a => a.getAttribute('href').startsWith('#')).map(a => [a, document.querySelector(a.getAttribute('href'))]);
/* na página da galeria os links do menu apontam para index.html#..., então não há destaque por rolagem */
if (map.length) addEventListener('scroll', () => {
  const y = scrollY + innerHeight * 0.35;
  let active = map[0];
  map.forEach(p => { if (p[1] && p[1].offsetTop <= y) active = p; });
  links.forEach(a => a.classList.toggle('is-active', a === active[0]));
}, { passive: true });


/* Recorte automático da margem transparente dos PNGs (logo, WhatsApp, Instagram e logos dos selos).
   Mede onde o desenho realmente começa e termina e ajusta --trim/--tx/--ty,
   para o desenho ocupar o tamanho da referência. Precisa que a página rode por servidor
   (ex.: Live Server); abrindo o arquivo direto (file://) o navegador bloqueia e o CSS usa o valor reserva. */
const trimCache = new Map();
const TRIM_SEL = '.brand img, .icon-btn img, .pill img, .drawer__btn img';

function measureTrim(img) {
  const src = img.currentSrc || img.src;
  if (trimCache.has(src)) return trimCache.get(src);
  let r = null;
  try {
    const k = Math.min(1, 300 / Math.max(img.naturalWidth, img.naturalHeight));
    const W = Math.max(1, Math.round(img.naturalWidth * k));
    const H = Math.max(1, Math.round(img.naturalHeight * k));
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, W, H);
    const d = ctx.getImageData(0, 0, W, H).data;
    let x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (d[(y * W + x) * 4 + 3] > 20) {
          if (x < x0) x0 = x; if (x > x1) x1 = x;
          if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
      }
    }
    if (x1 >= 0) {
      r = {
        f: W / (x1 - x0 + 1),
        tx: (x0 + x1 + 1) / 2 / W - 0.5,
        ty: (y0 + y1 + 1) / 2 / H - 0.5
      };
    }
  } catch (e) { /* file:// ou imagem bloqueada: usa o valor reserva do CSS */ }
  trimCache.set(src, r);
  return r;
}

function applyTrim(img) {
  if (!img.complete || !img.naturalWidth) return;
  const r = measureTrim(img);
  if (!r) return;
  img.style.setProperty('--trim', r.f.toFixed(4));
  img.style.setProperty('--tx', r.tx.toFixed(4));
  img.style.setProperty('--ty', r.ty.toFixed(4));
}

function trimAll() {
  document.querySelectorAll(TRIM_SEL).forEach(img => {
    if (img.complete) applyTrim(img);
    else img.addEventListener('load', () => applyTrim(img), { once: true });
  });
}

trimAll();
addEventListener('load', trimAll);
/* os clones do carrossel de empresas são criados depois: aplica neles também */
new MutationObserver(trimAll).observe(document.body, { childList: true, subtree: true });


/* Animação de entrada: os elementos aparecem conforme a página é rolada.
   Cada grupo = [seletor, tipo (up, down, left, right, zoom, fade), atraso entre itens, atraso inicial] em segundos.
   Se o visitante prefere menos movimento, nada é escondido nem animado. */
(function () {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;

  const groups = [
    ['.topbar > *',        'down',  .08, 0],
    ['.hero__text > *',    'up',    .12, .2],
    ['.hero__camera',      'zoom',  0,   .3],
    ['.shark--l',          'left',  0,   .4],
    ['.shark--r',          'right', 0,   .4],
    ['.clients__title',    'up',    0,   0],
    ['.clients .marquee',  'fade',  0,   .15],
    ['.about__notebook',   'left',  0,   0],
    ['.about__text > *',   'right', .14, .1],
    ['.works__title',      'up',    0,   0],
    ['.works .marquee',    'up',    0,   .1],
    ['.works__nav',        'up',    0,   .2],
    ['.g-hero__shark',     'left',  0,   .4],
    ['.g-hero__text > *',  'up',    .12, .2],
    ['.g-hero__frame',     'zoom',  0,   .3],
    ['.car__ui',           'up',    0,   .1],
    ['.cta .tail--l',      'left',  0,   0],
    ['.cta .tail--r',      'right', 0,   0],
    ['.cta h2',            'up',    0,   .1],
    ['.cta .btn',          'up',    0,   .3],
    ['.ast',               'zoom',  0,   .2]
  ];

  const items = [];
  groups.forEach(([sel, type, step, base]) => {
    document.querySelectorAll(sel).forEach((el, i) => {
      el.setAttribute('data-reveal', type);
      const d = base + i * step;
      el.style.setProperty('--d', d + 's');
      items.push([el, d]);
    });
  });

  document.documentElement.classList.add('js-reveal');
  void document.body.offsetHeight;   // fixa o estado inicial (escondido) antes de começar a animar

  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const el = e.target;
      io.unobserve(el);
      el.classList.add('is-in');
      const d = parseFloat(el.style.getPropertyValue('--d')) || 0;
      // depois que termina, devolve o elemento ao CSS normal (hover, transições próprias)
      setTimeout(() => {
        el.removeAttribute('data-reveal');
        el.classList.remove('is-in');
        el.style.removeProperty('--d');
      }, (d + 1.1) * 1000);
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -6% 0px' });

  items.forEach(([el]) => io.observe(el));
})();


/* ==========================================================
   GALERIA — é aqui que você cadastra os projetos.
   Para adicionar um projeto novo, copie um bloco da lista PROJETOS e troque os dados.

   slug       nome curto para o link (galeria.html#slug). Sem espaços nem acentos.
   titulo     título do projeto
   categoria  usada nos filtros (os botões são criados sozinhos a partir daqui)
   tint       cor da camada ao passar o mouse: red | blue | teal | pink | cream | orange
   bg         cor de fundo atrás da imagem grande na janela do projeto
   capa       imagem do card (pasta galeria/)
   capaAjuste 'recorte' = na janela a imagem grande usa o mesmo recorte do card (pos), em vez de se ajustar à proporção da imagem
   pos        enquadramento da capa no card (object-position), ex.: '50% 94%'
   resumo     frase curta que aparece ao passar o mouse
   texto      parágrafos da janela (aceita <strong>)
   cliente / servicos / ano    linhas de "ficha" (deixe '' para esconder)
   imagens    todas as imagens do projeto, a 1ª é a que abre grande.
              Para mostrar mais imagens é só incluir mais caminhos aqui.
   secoes     (opcional) lista de posts/carrosséis do projeto. A "capa" vira a imagem grande da janela
              e cada seção aparece como um post clicável (miniatura = 1º slide).
              Cada seção: { titulo, descricao, imagens: [...] }  (use slides() para montar a lista)
              Opcionais por seção:
                ratio      largura / altura dos slides (padrão 3/4; ex.: 4/5 para posts 1080x1350)
                tipo       'post' (padrão, carrossel) | 'documento' (imagem única)
                pdf        caminho de um PDF (aparece embutido, com botões abrir/baixar). Use com paginas e miniatura
                miniatura  imagem da miniatura (padrão: 1º slide); ajuste: 'contain' + corMiniatura: '#f4ead2'
                grupo      chave de um grupo, para dividir a lista em blocos (veja "grupos")
   subtitulo  (só com secoes) título da grade de posts, ex.: 'Posts da Inklua'
   grupos     (opcional, com secoes) blocos da lista: { chave: { titulo: 'Posts', dica: 'texto de ajuda' }, ... }
   album      (opcional) galeria com rótulos: [{ rotulo: 'Capa', imagem: '...', ratio: '1 / 1' }, ...]
              (ratio = largura / altura da imagem; a moldura se ajusta a cada uma). Use no lugar de "imagens".
   categoria  pode ser um texto ('Branding') ou uma lista (['Impresso', 'Social media']).

   Pasta dos projetos: projetos da Min/<Projeto>/<Seção>/<arquivos>
   A função slides() monta a lista de arquivos de uma pasta numerada:
     slides(BASE_INKLUA, 'Checklist', 5, 'row-1-column-')  ->  .../Checklist/row-1-column-1.png ... 5.png
     slides(BASE_INKLUA, 'Vale a pena indicar de novo', 6) ->  .../Vale a pena indicar de novo/1.png ... 6.png
   ========================================================== */
const slides = (base, pasta, n, prefixo = '', ext = '.png') =>
  Array.from({ length: n }, (_, i) => `${base}${pasta}/${prefixo}${i + 1}${ext}`);

const BASE_INKLUA = 'projetos da Min/Inklua/';
const BASE_INTUITIVA = 'projetos da Min/Intuitiva/';
const BASE_KARINA = 'projetos da Min/Karina Aviles/';
const BASE_BISTRO = 'projetos da Min/Material Bistrô 48/';
const bistro = nome => BASE_BISTRO + 'Bistrô 48 - ' + nome;   // os arquivos do Bistrô são "Bistrô 48 - <nome>"
const BASE_GASTRO = 'projetos da Min/Material Gastrofood/';
const BASE_LONTREZ = 'projetos da Min/Projeto Pessoal Lontrêz/';
const BASE_NOX = 'projetos da Min/Nox Tattoo Studio/';
const nox = nome => BASE_NOX + 'Nox - ' + nome;   // os arquivos são "Nox - <nome>"
const BASE_MEGABAITA = 'projetos da Min/Material Mega Baita/';
const mb = nome => BASE_MEGABAITA + 'Mega Baita - ' + nome;   // os arquivos são "Mega Baita - <nome>"
const BASE_HAMBURGAO = 'projetos da Min/Material Hamburgão/';
const hamb = nome => BASE_HAMBURGAO + 'Hamburgão - ' + nome;   // os arquivos são "Hamburgão - <nome>"
const BASE_VITORIA = 'projetos da Min/Hotel Vitória/';
const BASE_BOSSA = 'projetos da Min/Bossa/';
const bossa = nome => BASE_BOSSA + 'Bossa - ' + nome;   // os arquivos da Bossa são "Bossa - <nome>"
const BASE_ESTUDOS = 'projetos da Min/Estudos de Caso/';
const ec = (pasta, nome) => `${BASE_ESTUDOS}${pasta}/${nome}`;   // os arquivos são "<Caso> - <nome>" dentro da pasta de cada caso

/* ==========================================================
   WHATSAPP: botão "quero um projeto assim" da janela de cada projeto.
   Cada projeto abre o WhatsApp com a SUA mensagem (chave = slug do projeto).
   Para mudar o texto de um projeto, edite a linha dele aqui.
   Projeto sem linha aqui usa a mensagem padrão (msgPadrao).
   ========================================================== */
const WHATS = '5511965270351';
const msgPadrao = p => `Olá Min, vim pelo seu portfólio e quero um projeto igual ao "${p.titulo}"! Gostaria de mais informações.`;
const MENSAGENS = {
  'album-intuitiva':          'Olá Min! Vi a capa do Álbum Intuitiva no seu portfólio e quero uma capa de álbum igual a essa!',
  'branding-lontrez':         'Olá Min! Vi o Branding Lontrêz no seu portfólio e quero uma identidade visual igual a essa!',
  'inklua':                   'Olá Min! Vi os materiais da Inklua no seu portfólio e quero um projeto igual a esse (folder e carrosséis)!',
  'social-media-gastrofood':  'Olá Min! Vi o Social Media Gastrofood no seu portfólio e quero uma social media igual a essa!',
  'portfolio-karina-aviles':  'Olá Min! Vi o Portfólio da Karina Aviles no seu portfólio e quero um projeto igual a esse!',
  'social-media-bistro-48':   'Olá Min! Vi a social media do Bistrô 48 no seu portfólio e quero uma igual a essa!',
  'social-media-bossa':       'Olá Min! Vi a social media da Bossa Hamburgueria no seu portfólio e quero uma igual a essa!',
  'social-media-hamburgao':   'Olá Min! Vi a social media do Hamburgão Lanches no seu portfólio e quero uma igual a essa!',
  'mega-baita':               'Olá Min! Vi o projeto da Mega Baita Lanchonete no seu portfólio e quero um igual a esse!',
  'hotel-vitoria':            'Olá Min! Vi o projeto da Vitória Hotéis no seu portfólio e quero um igual a esse!',
  'nox-tattoo-studio':        'Olá Min! Vi o Nox Tattoo Studio no seu portfólio e quero uma identidade visual igual a essa!',
  'atelie-da-min':            'Olá Min! Vi o Ateliê da Min no seu portfólio e quero um projeto igual a esse!'
};
const linkWhats = p => 'https://wa.me/' + WHATS + '?text=' + encodeURIComponent(MENSAGENS[p.slug] || msgPadrao(p));

const PROJETOS = [
  {
    slug: 'album-intuitiva',
    titulo: 'Álbum Intuitiva',
    categoria: 'Música',
    tint: 'red',
    bg: '#5b0b0b',
    capa: BASE_INTUITIVA + 'Mockup Intuitiva.png',
    pos: '50% 50%',
    resumo: 'Uma estética que representa a intuição como algo natural, emocional e autêntico.',
    texto: [
      'A capa do álbum <strong>Intuitiva</strong> foi desenvolvida com a proposta de traduzir visualmente a sensibilidade e a identidade do projeto. A ideia foi criar uma estética que representasse a intuição como algo <strong>natural, emocional e autêntico.</strong>',
      'O projeto reúne a <strong>capa</strong> e a <strong>contracapa com a tracklist.</strong> Clique em cada imagem pra virar o disco.'
    ],
    cliente: 'Intuitiva',
    servicos: 'Capa de álbum · Direção de arte',
    ano: '',
    /* album: galeria com rótulos (aparecem nas miniaturas). A 1ª imagem abre grande. */
    album: [
      { rotulo: 'Capa',       imagem: BASE_INTUITIVA + 'Capa Frente Intuitiva.jpg',  ratio: '1 / 1' },
      { rotulo: 'Contracapa', imagem: BASE_INTUITIVA + 'Contra-capa Intuitiva.png', ratio: '1 / 1' }
    ]
  },
  {
    slug: 'branding-lontrez',
    titulo: 'Branding Lontrêz',
    categoria: 'Branding',
    subtitulo: 'Manual da marca',
    tint: 'blue',
    bg: '#0f72cc',
    capa: 'projetos da Min/Projeto Pessoal Lontrêz/Capa Lontrez Bloco 3.png',
    pos: '50% 50%',
    resumo: 'Uma marca jovem, acessível e acolhedora para o universo dos idiomas, apresentada em manual.',
    texto: [
      'Projeto fictício de identidade visual da <strong>Lontrêz,</strong> escola de francês, italiano e espanhol para crianças. A marca nasce da <strong>leveza e do senso de coletivo das lontras,</strong> com logotipo desenhado à mão, boina no lugar do acento e o “L” que vira o rabo da lontra.',
      'Tudo está reunido no <strong>manual da marca,</strong> com logotipo, paleta de cores, a mascote <strong>Florentine,</strong> elementos de apoio, tipografia e exemplos de aplicação. Clique pra folhear.'
    ],
    cliente: 'Lontrêz Escola de Idiomas (projeto fictício)',
    servicos: 'Identidade visual · Branding · Manual da marca',
    ano: '2026',
    grupos: {
      docs: { titulo: 'Manual da marca', dica: 'Apresentação completa da identidade. Clique pra folhear' }
    },
    secoes: [
      { grupo: 'docs', ratio: 16 / 9, titulo: 'Manual da marca Lontrêz', descricao: 'Logotipo, paleta de cores, mascote, elementos de apoio, tipografia, propósito e aplicações da marca.',
        miniatura: BASE_LONTREZ + 'Capa Lontrez Bloco 3.png', ajuste: 'contain', corMiniatura: '#0f72cc',
        imagens: Array.from({ length: 25 }, (_, i) => BASE_LONTREZ + `Manual ${String(i + 1).padStart(2, '0')}.jpg`) }
    ]
  },
  {
    slug: 'inklua',
    titulo: 'Inklua',
    categoria: ['Impresso', 'Social media'],
    subtitulo: 'Posts da Inklua',
    tint: 'teal',
    bg: '#d0d0d0',
    capa: BASE_INKLUA + 'Capa Inklua Bloco 3.png',   // o folder: vira a capa do card e a imagem grande da janela
    pos: '50% 50%',
    resumo: 'Material impresso e carrosséis que apresentam a missão da Inklua de forma clara e acolhedora.',
    texto: [
      'Materiais criados para apresentar a <strong>missão da Inklua</strong> de forma clara e acolhedora, conectando pessoas com deficiência ao mercado de trabalho.',
      'Além do <strong>folder institucional</strong>, o projeto reúne uma série de <strong>carrosséis para as redes sociais.</strong> Clique num post para ver o carrossel completo.'
    ],
    cliente: 'Inklua',
    servicos: 'Design editorial · Material impresso · Social media',
    ano: '2024',
    secoes: [
      {
        titulo: 'Coisas que nasceram da acessibilidade',
        descricao: 'Mostra como legendas, comando de voz e teclado preditivo nasceram da acessibilidade e hoje servem a todo mundo.',
        imagens: slides(BASE_INKLUA, 'Coisas que nasceram da acessibilidade', 6, 'row-1-column-')
      },
      {
        titulo: 'Assombros do capacitismo',
        descricao: 'Edição de Halloween que usa fantasmas e cemitério para falar dos “terrores” reais do capacitismo.',
        imagens: slides(BASE_INKLUA, 'Assombros do capacitismo', 6)
      },
      {
        titulo: 'Café Inclusivo',
        descricao: 'Divulgação do projeto Café Inclusivo no Dia do Café, com formação técnica, degustações e oficinas.',
        imagens: slides(BASE_INKLUA, 'Café Inclusivo', 5, 'row-1-column-')
      },
      {
        titulo: 'Checklist',
        descricao: 'Checklist para processos seletivos de PcDs: do perfil atualizado ao preparo para a entrevista.',
        imagens: slides(BASE_INKLUA, 'Checklist', 5, 'row-1-column-')
      },
      {
        titulo: 'Vale a pena indicar de novo',
        descricao: 'Filmes e séries do #InkluaIndica que continuam relevantes, com sinopse e avaliação.',
        imagens: slides(BASE_INKLUA, 'Vale a pena indicar de novo', 6)
      },
      {
        titulo: 'Como a Inklua funciona',
        descricao: 'Explica, passo a passo, como a plataforma conecta candidatos a vagas de empresas parceiras.',
        imagens: slides(BASE_INKLUA, 'Como a inklua funciona', 5, 'row-1-column-')
      },
      {
        titulo: 'Quando a vida te dá limões',
        descricao: 'Série com tema de limões: legenda, audiodescrição e contraste como soluções de design acessível.',
        imagens: slides(BASE_INKLUA, 'Quando vida te dá limões', 6, 'row-1-column-')
      }
    ]
  },
  {
    slug: 'social-media-gastrofood',
    capaAjuste: 'recorte',   // na janela mostra o mesmo recorte do card (só a moça), usando o 'pos' abaixo
    titulo: 'Social Media Gastrofood',
    categoria: 'Social media',
    subtitulo: 'Posts e carrosséis',
    tint: 'pink',
    bg: '#ffffff',
    capa: 'projetos da Min/Material Gastrofood/Capa Gastrofood Bloco 3.png',
    pos: '50% 94%',
    resumo: 'Peças com linguagem direta e visual marcante para chamar atenção no feed.',
    texto: [
      'Peças para redes sociais com <strong>linguagem direta e visual marcante,</strong> pensadas para chamar atenção no feed e conversar com o público.',
      'O projeto reúne <strong>carrosséis de conteúdo</strong> sobre orçamento e sobre IA no marketing, além de um <strong>post de feedbacks</strong> de clientes. Clique num post para ver o carrossel completo.'
    ],
    cliente: 'Gastrofood',
    servicos: 'Social media · Posts para feed · Carrosséis',
    ano: '2026',
    secoes: [
      { ratio: 4 / 5, titulo: 'Vários orçamentos abertos…', descricao: 'Mostra por que comparar só por preço engana: cada agência escreve o escopo de um jeito e o orçamento explicado faz diferença.',
        imagens: [1, 2, 3, 4].map(n => `${BASE_GASTRO}Gastrofood - Carrossel Orçamento/${n}.png`) },
      { ratio: 4 / 5, titulo: 'IA x Profissional de marketing', descricao: 'Carrossel sobre o que a IA pode ajudar a fazer e por que o feed ainda precisa de direção e criatividade humana.',
        imagens: [
          `${BASE_GASTRO}Gastrofood - IA x Profissional de MKT/1.png`,
          `${BASE_GASTRO}Gastrofood - IA x Profissional de MKT/2.png`,
          `${BASE_GASTRO}Gastrofood - IA x Profissional de MKT/3.png`,
          `${BASE_GASTRO}Gastrofood - IA x Profissional de MKT/4 vídeo.mp4`,   // slide em vídeo (use 4.png para a versão estática)
          `${BASE_GASTRO}Gastrofood - IA x Profissional de MKT/5.png`,
          `${BASE_GASTRO}Gastrofood - IA x Profissional de MKT/6.png`,
          `${BASE_GASTRO}Gastrofood - IA x Profissional de MKT/7.png`
        ] },
      { ratio: 1, titulo: 'Nossos clientes falam por nós!', descricao: 'Post de prova social com depoimentos de clientes da Gastrofood.',
        imagens: [BASE_GASTRO + 'Gastrofood  Feedbacks.png'] }
    ]
  },
  {
    slug: 'portfolio-karina-aviles',
    titulo: 'Portfólio Karina Aviles',
    categoria: 'Social media',
    subtitulo: 'Posts e documentos',
    tint: 'cream',
    bg: '#f3e9d4',
    capa: 'projetos da Min/Karina Aviles/Capa Karina Aviles Bloco 3.png',
    pos: '50% 50%',
    resumo: 'Identidade leve e com personalidade, apresentando os trabalhos de forma organizada.',
    texto: [
      'Portfólio de social media com <strong>identidade leve e personalidade,</strong> apresentando os trabalhos de forma organizada e atrativa.',
      'O projeto reúne <strong>carrosséis para as redes sociais</strong> e os <strong>documentos de apresentação:</strong> portfólio em PDF, carta de apresentação e currículo. Clique num item pra ver.'
    ],
    cliente: 'Karina Aviles',
    servicos: 'Social media · Portfólio · Currículo',
    ano: '',
    grupos: {
      posts: { titulo: 'Posts da Karina', dica: 'Clique num post para ver o carrossel completo' },
      docs:  { titulo: 'Documentos',      dica: 'Portfólio em PDF, carta de apresentação e currículo' }
    },
    secoes: [
      {
        grupo: 'posts',
        titulo: 'Você já se viu em alguém?',
        descricao: 'Sobre representatividade: ser visto com respeito, verdade e dignidade, e como ela transforma.',
        imagens: slides(BASE_KARINA, 'vc já se viu em alguém', 6)
      },
      {
        grupo: 'posts',
        titulo: 'A invisibilidade das PcDs nos relacionamentos',
        descricao: 'Sobre pessoas com deficiência invisibilizadas no amor, com desejos, sonhos e afetos como qualquer outra.',
        ratio: 4 / 5,   // posts 1080x1350
        // os arquivos 2 e 3 não vieram no zip; se existirem, é só incluir na lista
        imagens: [1, 4, 5, 6, 7, 8].map(n => `${BASE_KARINA}A invisibilidade das pcds/${n}.png`)
      },
      {
        grupo: 'posts',
        titulo: 'Jesus vai te curar!',
        descricao: 'Relato sobre capacitismo religioso: a ideia de que a deficiência precisa de cura e o que ela faz com a identidade.',
        imagens: slides(BASE_KARINA, 'JESUS VAI TE CURAR', 10)
      },
      {
        grupo: 'docs',
        tipo: 'documento',
        titulo: 'Portfólio',
        descricao: 'Portfólio de social media em PDF, com os trabalhos da Karina.',
        pdf: BASE_KARINA + 'Portfolio Karina Aviles.pdf',
        paginas: 12,
        ratio: 16 / 9,
        miniatura: BASE_KARINA + 'Portfolio Karina Aviles - Capa.png',
        ajuste: 'contain',
        corMiniatura: '#f4ead2',
        imagens: []
      },
      {
        grupo: 'docs',
        tipo: 'documento',
        titulo: 'Carta de apresentação',
        descricao: 'Carta de apresentação da Karina, no mesmo estilo visual do portfólio.',
        ratio: 1414 / 2000,
        imagens: [BASE_KARINA + 'Carta de Apresentação Karina Aviles.png']
      },
      {
        grupo: 'docs',
        tipo: 'documento',
        titulo: 'Currículo',
        descricao: 'Currículo da Karina, com a mesma identidade leve do portfólio.',
        ratio: 1414 / 2000,
        imagens: [BASE_KARINA + 'Currículo Karina Aviles.png']
      }
    ]
  },
  {
    slug: 'social-media-bistro-48',
    titulo: 'Bistrô 48',
    categoria: 'Social media',
    subtitulo: 'Posts e stories',
    tint: 'orange',
    bg: '#17120d',
    capa: BASE_BISTRO + 'Capa Bistrô 48.png',   // provisório: troque pelo banner escolhido
    pos: '50% 50%',
    resumo: 'Social media de hamburgueria com cara premium: preto, laranja e muito apetite.',
    texto: [
      'Social media do <strong>Bistrô 48,</strong> hamburgueria gourmet no Roçado, em São José. A comunicação aposta em <strong>preto e laranja, tipografia forte</strong> e fotos que dão fome.',
      'O projeto reúne <strong>posts de feed, stories</strong> de promoções, parcerias, eventos e música ao vivo. Clique num item pra ver.'
    ],
    cliente: 'Bistrô 48',
    servicos: 'Social media · Posts · Stories',
    ano: '',
    grupos: {
      feed:    { titulo: 'Posts do feed', dica: 'Clique num post para ver' },
      stories: { titulo: 'Stories',       dica: 'Clique num story para ver' }
    },
    secoes: [
      { grupo: 'feed', ratio: 4 / 5, titulo: 'Onion Prime e cupom em dobro', descricao: 'Carrossel com a promoção do Onion Prime (versão laranja e escura) e o cupom em dobro.',
        imagens: [bistro('Feed 1.png'), bistro('Feed 2.png'), bistro('Feed 3.png')] },
      { grupo: 'feed', ratio: 4 / 5, titulo: 'Parceria Duo Gourmet', descricao: 'Anúncio da nova parceria com o app Duo Gourmet e como aproveitar.',
        imagens: [bistro('Duo Gourmet Feed.png')] },
      { grupo: 'feed', ratio: 4 / 5, titulo: 'Eventos durante o dia', descricao: 'Divulgação do espaço para festas de aniversário e eventos corporativos.',
        imagens: [bistro('Eventos.png')] },
      { grupo: 'feed', ratio: 4 / 5, titulo: 'Música ao vivo', descricao: 'Convite para a noite com música ao vivo, com data, horário e atração.',
        imagens: [bistro('Músicos Feed.png')] },
      { grupo: 'feed', ratio: 4 / 5, titulo: 'Show de Comédia', descricao: 'Divulgação do show de stand-up, com data, horários e chamada para o ingresso.',
        imagens: [bistro('Show de Comédia Feed.png')] },
      { grupo: 'stories', ratio: 9 / 16, titulo: 'Stories do Bistrô', descricao: 'Delivery, ambiente, funcionamento, cupom em dobro e Onion Prime.',
        imagens: [bistro('Storys 1.png'), bistro('Storys 2.png'), bistro('Storys 3.png'), bistro('Storys 4.png'), bistro('Storys 5.png')] },
      { grupo: 'stories', ratio: 9 / 16, titulo: 'Em dose dupla!', descricao: 'Série de promoções: dois burgers e batata canoa por um preço fechado.',
        imagens: [bistro('Bacon Duplo.png'), bistro('Burguer Cheese.png'), bistro('Burguer Quattrocheese.png'),
                  bistro('Burguer da Casa.png'), bistro('Onion Prime.png'), bistro('Compre 2 Leve 3.png')] },
      { grupo: 'stories', ratio: 9 / 16, titulo: 'Parceria Duo Gourmet', descricao: 'Story da parceria com o app Duo Gourmet.',
        imagens: [bistro('Duo Gourmet Story.png')] },
      { grupo: 'stories', ratio: 9 / 16, titulo: 'Música ao vivo', descricao: 'Story com a atração e o horário da noite de música.',
        imagens: [bistro('Músicos Story.png')] },
      { grupo: 'stories', ratio: 9 / 16, titulo: 'Show de Comédia', descricao: 'Story do show de stand-up.',
        imagens: [bistro('Show de Comédia Storys.png')] }
    ]
  },
  {
    slug: 'social-media-bossa',
    titulo: 'Bossa Hamburgueria',
    categoria: 'Social media',
    subtitulo: 'Posts e stories',
    tint: 'orange',
    bg: '#eaa538',
    capa: BASE_BOSSA + 'Capa Bossa.png',
    pos: '50% 50%',
    resumo: 'Identidade e social media com atitude carioca: mostarda, preto e branco e o zig-zag de Copacabana.',
    texto: [
      'Social media da <strong>Bossa,</strong> hamburgueria artesanal de burgers de 180g que nasceu em Balneário Camboriú e abriu um novo capítulo no Córrego Grande, em Florianópolis. A comunicação junta <strong>fotografia de produto, tipografia condensada</strong> de forte presença e o <strong>zig-zag da marca,</strong> uma referência às ondas de Copacabana.',
      'O projeto reúne <strong>posts de feed, stories</strong> com promoções, happy hour, posicionamento e a história da marca. Clique num item pra ver.'
    ],
    cliente: 'Bossa Hamburgueria',
    servicos: 'Social media · Identidade visual · Posts · Stories',
    ano: '2026',
    grupos: {
      feed:    { titulo: 'Posts do feed', dica: 'Clique num post para ver' },
      stories: { titulo: 'Stories',       dica: 'Clique num story para ver' }
    },
    secoes: [
      { grupo: 'feed', ratio: 4 / 5, titulo: 'Cozinhar? Hoje não', descricao: 'Chamada de delivery com o burger em primeiro plano, endereço e horário de funcionamento.',
        imagens: [bossa('Feed 1.png')] },
      { grupo: 'feed', ratio: 4 / 5, titulo: 'Happy Hour, Bossa Hour', descricao: 'Convite para o happy hour: burger de 180g, caipirinha gelada e música boa.',
        imagens: [bossa('Feed 2.png')] },
      { grupo: 'feed', ratio: 4 / 5, titulo: 'Keep it bold, keep it Bossa', descricao: 'Post de posicionamento: 180g de carne, ingredientes de qualidade e uma pitada de Rio em cada mordida.',
        imagens: [bossa('Feed 3.png')] },
      { grupo: 'feed', ratio: 4 / 5, titulo: 'Uma noite saborosa', descricao: 'Nota fiscal como recurso gráfico, com o combo da casa sobre o zig-zag preto e branco.',
        imagens: [bossa('Feed 4.png')] },
      { grupo: 'feed', ratio: 4 / 5, titulo: 'Where’s the burguer?', descricao: 'Post de localização em fundo mostarda, com o endereço da Bossa no Córrego Grande.',
        imagens: [bossa('Feed 5.png')] },
      { grupo: 'feed', ratio: 4 / 5, titulo: 'Do Rio para Balneário', descricao: 'A história da marca: a paixão por hambúrguer que atravessou o mapa e virou a Bossa.',
        imagens: [bossa('Feed 6.png')] },
      { grupo: 'feed', ratio: 4 / 5, titulo: 'Dia do Cliente', descricao: 'Ação especial: na compra de qualquer hambúrguer marcando a Bossa, uma batata de cortesia.',
        imagens: [bossa('Dia do Cliente Feed.png')] },
      { grupo: 'stories', ratio: 9 / 16, titulo: 'Stories da Bossa', descricao: 'Série de stories com delivery, happy hour, posicionamento, nota fiscal, endereço e a história da marca.',
        imagens: [bossa('Story 1.png'), bossa('Story 2.png'), bossa('Story 3.png'), bossa('Story 4.png'), bossa('Story 5.png'), bossa('Story 6.png')] },
      { grupo: 'stories', ratio: 9 / 16, titulo: 'Dia do Cliente', descricao: 'Story da ação do Dia do Cliente, com a batata bossa de cortesia.',
        imagens: [bossa('Dia do Cliente Story.png')] }
    ]
  },
  {
    slug: 'social-media-hamburgao',
    titulo: 'Hamburgão Lanches',
    categoria: 'Social media',
    subtitulo: 'Posts e stories',
    tint: 'orange',
    bg: '#f59a00',
    capa: BASE_HAMBURGAO + 'Mockup hamburgão.png',
    pos: '50% 50%',
    resumo: 'Social media de lanchonete com cara de promoção: laranja, amarelo e burgers em destaque.',
    texto: [
      'Social media do <strong>Hamburgão Lanches,</strong> com unidades no Estreito e em Coqueiros, em Florianópolis. A comunicação aposta em <strong>laranja e amarelo,</strong> títulos grandes em caixa alta e <strong>fotos de burger em destaque</strong> para dar fome e levar o cliente a pedir.',
      'O projeto reúne <strong>posts de feed e stories</strong> sobre endereços, horários, promoção e delivery, além de um <strong>mockup</strong> da peça aplicada. Clique num item pra ver.'
    ],
    cliente: 'Hamburgão Lanches',
    servicos: 'Social media · Posts · Stories',
    ano: '',
    grupos: {
      feed:    { titulo: 'Posts do feed', dica: 'Clique num post para ver' },
      stories: { titulo: 'Stories',       dica: 'Clique num story para ver' }
    },
    secoes: [
      { grupo: 'feed', ratio: 4 / 5, titulo: 'Saiba onde estamos', descricao: 'Endereço das duas unidades, Estreito e Coqueiros, sobre um burger de frango crocante.',
        imagens: [hamb('Feed 1.png')] },
      { grupo: 'feed', ratio: 4 / 5, titulo: 'O melhor burguer de Coqueiros!', descricao: 'Post de posicionamento da unidade de Coqueiros, com o burger bem de perto.',
        imagens: [hamb('Feed 2.png')] },
      { grupo: 'feed', ratio: 4 / 5, titulo: 'Horário de funcionamento', descricao: 'Horários de cada unidade, com relógios como elemento gráfico.',
        imagens: [hamb('Feed 3.png')] },
      { grupo: 'feed', ratio: 4 / 5, titulo: 'O melhor lanche em Estreito', descricao: 'Convite para pedir na unidade do Estreito, com o contato para pedido.',
        imagens: [hamb('Feed 4.png')] },
      { grupo: 'feed', ratio: 4 / 5, titulo: 'Hoje tem promoção!', descricao: 'Lembrete no estilo caixa de mensagem: na compra de 1 hambúrguer, o 2º é grátis.',
        imagens: [hamb('Feed 5.png')] },
      { grupo: 'feed', ratio: 4 / 5, titulo: 'Delivery tá on', descricao: 'Aviso de delivery com horário de atendimento e contato para pedido.',
        imagens: [hamb('Feed 6.png')] },
      { grupo: 'stories', ratio: 9 / 16, titulo: 'Stories do Hamburgão', descricao: 'Série de stories com endereços, horários, promoção e delivery.',
        imagens: [hamb('Story 1.png'), hamb('Story 2.png'), hamb('Story 3.png'), hamb('Story 4.png'), hamb('Story 5.png'), hamb('Story 6.png')] }
    ]
  },
  {
    slug: 'mega-baita',
    titulo: 'Mega Baita Lanchonete',
    categoria: ['Social media', 'Impresso'],
    subtitulo: 'Social media, site e impressos',
    tint: 'orange',
    bg: '#111111',
    capa: BASE_MEGABAITA + 'Capa Mega Baita.jpg',
    pos: '50% 50%',
    resumo: 'Do feed ao cardápio: preto, amarelo e xadrez de táxi em todas as peças da lanchonete.',
    texto: [
      'Material de comunicação da <strong>Mega Baita Lanchonete,</strong> com unidades em Potecas e Areias, em São José (SC). A linguagem junta <strong>preto, amarelo e o xadrez</strong> como assinatura, com títulos fortes e fotos de lanche que dão fome.',
      'O projeto reúne <strong>posts de feed e stories,</strong> o <strong>banner do site,</strong> os <strong>cardápios</strong> de cada unidade e <strong>impressos,</strong> como a lona do almoço e o panfleto de desconto. Clique num item pra ver.'
    ],
    cliente: 'Mega Baita Lanchonete',
    servicos: 'Social media · Banner de site · Cardápio · Impressos',
    ano: '',
    grupos: {
      feed:      { titulo: 'Posts do feed', dica: 'Clique num post para ver' },
      stories:   { titulo: 'Stories',       dica: 'Clique num story para ver' },
      site:      { titulo: 'Banner do site', dica: 'Peça para o topo do site' },
      cardapios: { titulo: 'Cardápios',     dica: 'Um cardápio por unidade, com frente e verso' },
      impressos: { titulo: 'Impressos',     dica: 'Lona e panfleto' }
    },
    secoes: [
      { grupo: 'feed', ratio: 4 / 5, titulo: 'Fome de verdade? É na Mega Baita!', descricao: 'Post de apresentação com o lanche grande, farto e do jeito que você gosta.',
        imagens: [mb('Feed 1.jpg')] },
      { grupo: 'feed', ratio: 4 / 5, titulo: 'Fome de um docinho?', descricao: 'Post de sobremesa com nutella, morango fresco e aquele toque que só a gente tem.',
        imagens: [mb('Feed 2.jpg')] },
      { grupo: 'feed', ratio: 4 / 5, titulo: 'Bateu a vontade?', descricao: 'Endereço e horário das unidades Potecas e Areias, em duas versões: escura e amarela.',
        imagens: [mb('Feed 3.jpg'), mb('Feed 4.jpg')] },
      { grupo: 'feed', ratio: 4 / 5, titulo: '2 pelo 1', descricao: 'Combo duplo com batata e refri pra dividir (ou não), com o preço em destaque.',
        imagens: [mb('Feed 5.jpg')] },
      { grupo: 'feed', ratio: 4 / 5, titulo: 'A dieta só começa depois do hambúrguer', descricao: 'Post bem-humorado com a foto do burger dentro da moldura de uma rede social.',
        imagens: [mb('Feed 6.jpg')] },
      { grupo: 'feed', ratio: 4 / 5, titulo: 'Já está sabendo da novidade?', descricao: 'Aviso de que o delivery agora funciona a partir das onze, com dias e horários.',
        imagens: [mb('Feed 7.jpg')] },
      { grupo: 'stories', ratio: 9 / 16, titulo: 'Stories da Mega Baita', descricao: 'Série de stories com as mesmas campanhas do feed: lanche, docinho, unidades, 2 pelo 1, delivery e a dieta.',
        imagens: [mb('Story 1.jpg'), mb('Story 2.jpg'), mb('Story 3.jpg'), mb('Story 4.jpg'), mb('Story 5.jpg'), mb('Story 6.jpg')] },
      { grupo: 'stories', ratio: 9 / 16, titulo: 'Temos almoço', descricao: 'Story que avisa do almoço de segunda a sexta, com lanches e pratos.',
        imagens: [mb('Story Temos Almoço.jpg')] },
      { grupo: 'stories', ratio: 9 / 16, titulo: 'Estamos contratando', descricao: 'Story de divulgação de vaga para a unidade Potecas.',
        imagens: [mb('Story Estamos Contratando.jpg')] },
      { grupo: 'site', ratio: 952.5 / 345, titulo: 'Banner do site', descricao: 'Banner de topo com a chamada “Bateu a fome?” e atalhos para lanches, porções e bebidas.',
        imagens: [mb('Banner Site.jpg')] },
      { grupo: 'cardapios', ratio: 1190.25 / 842.25, titulo: 'Cardápio Areias', descricao: 'Cardápio em A3 da unidade Areias, com lanches, X Calota, gourmet, hot dog, trios, porções, bebidas e sobremesas.',
        imagens: [mb('Cardápio Areias 1.jpg'), mb('Cardápio Areias 2.jpg')] },
      { grupo: 'cardapios', ratio: 1190.25 / 842.25, titulo: 'Cardápio Potecas', descricao: 'Cardápio em A3 da unidade Potecas, no mesmo layout, com os preços e itens dessa unidade.',
        imagens: [mb('Cardápio Potecas 1.jpg'), mb('Cardápio Potecas 2.jpg')] },
      { grupo: 'impressos', ratio: 4053.75 / 3288, titulo: 'Arte de lona: almoço', descricao: 'Lona para a fachada anunciando que agora tem almoço, com delivery e retirada.',
        imagens: [mb('Arte Lona Almoço.jpg')] },
      { grupo: 'impressos', ratio: 422.25 / 198.75, titulo: 'Panfleto 50 reais', descricao: 'Panfleto no formato de nota de 50 reais: de um lado a nota, do outro o cupom de 10% off e o bônus de fritas.',
        imagens: [mb('Panfleto 50 Reais 1.jpg'), mb('Panfleto 50 Reais 2.jpg')] }
    ]
  },
  {
    slug: 'hotel-vitoria',
    titulo: 'Vitória Hotéis',
    categoria: 'Social media',
    subtitulo: 'Posts, stories e e-mail marketing',
    tint: 'teal',
    bg: '#0c483a',
    capa: BASE_VITORIA + 'Banner Hotel Vitória.png',
    pos: '50% 50%',
    resumo: 'Comunicação acolhedora para uma pousada na serra: verde profundo, dourado e cartão-postal de inverno.',
    texto: [
      'Comunicação do <strong>Vitória Hotéis,</strong> pousada em Campos do Jordão (SP). A identidade une <strong>verde profundo, dourado e a flor de lótus</strong> da marca, com a serenidade e o aconchego de uma escapada de inverno.',
      'O projeto reúne um <strong>post de feed e um story</strong> no estilo cartão-postal e um <strong>e-mail marketing</strong> com a campanha de inverno e o Dia dos Pais. Clique num item pra ver.'
    ],
    cliente: 'Vitória Hotéis (projeto fictício)',
    servicos: 'Social media · E-mail marketing · Direção de arte',
    ano: '2026',
    grupos: {
      feed:    { titulo: 'Posts do feed', dica: 'Clique num post para ver' },
      stories: { titulo: 'Stories',       dica: 'Clique num story para ver' },
      email:   { titulo: 'E-mail marketing', dica: 'Mailing da campanha de inverno' }
    },
    secoes: [
      { grupo: 'feed', ratio: 1, titulo: 'Uma pausa essencial para o seu inverno', descricao: 'Post em formato de cartão-postal, com lareira, chá da tarde e massagem restauradora para reservar a estadia.',
        imagens: [BASE_VITORIA + 'Feed.png'] },
      { grupo: 'stories', ratio: 9 / 16, titulo: 'Uma pausa essencial para o seu inverno', descricao: 'Versão vertical do cartão-postal, com o chamado “Reserve agora!”.',
        imagens: [BASE_VITORIA + 'Story.png'] },
      { grupo: 'email', tipo: 'documento', ratio: 600 / 1249, titulo: 'Conforto e inverno', descricao: 'Mailing com a escapada de inverno e a promoção do Dia dos Pais, com botões de reserva.',
        imagens: [BASE_VITORIA + 'Mailing.png'] }
    ]
  },
  {
    slug: 'nox-tattoo-studio',
    titulo: 'Nox Tattoo Studio',
    categoria: ['Branding', 'Social media'],
    subtitulo: 'Apresentação, posts e cartão',
    tint: 'cream',
    bg: '#111111',
    capa: BASE_NOX + 'Capa Nox.png',
    pos: '50% 50%',
    resumo: 'Identidade em blackletter, com a gata de crânio como símbolo, posts e cartão de visita.',
    texto: [
      'Identidade visual do <strong>Nox Tattoo Studio,</strong> a tradução visual da noite e do mistério que ela carrega. Inspirada na deusa que personifica a escuridão e no gato, animal noturno que enxerga onde outros não veem, a marca une <strong>blackletter marcante, azul profundo e pequenas estrelas</strong> que brilham no escuro.',
      'O projeto reúne a <strong>apresentação da marca,</strong> com logotipo, conceito, adesivos e aplicações, os <strong>posts de redes sociais</strong> (cuidados com a tatuagem e flash tattoo) e o <strong>cartão de visita.</strong> Clique num item pra ver.'
    ],
    cliente: 'Nox Tattoo Studio',
    servicos: 'Identidade visual · Social media · Cartão de visita',
    ano: '',
    grupos: {
      apresentacao: { titulo: 'Apresentação da marca', dica: 'Logotipo, conceito e aplicações da identidade' },
      posts:        { titulo: 'Posts',                 dica: 'Clique num post para ver o carrossel completo' },
      impressos:    { titulo: 'Impressos',             dica: 'Cartão de visita' }
    },
    secoes: [
      { grupo: 'apresentacao', ratio: 1400 / 800, titulo: 'Apresentação Nox Tattoo Studio', descricao: 'Logotipo, conceito da marca, o mascote, versões positiva e negativa, adesivos e aplicações em cartão, fachada, ecobag e posts.',
        imagens: Array.from({ length: 11 }, (_, i) => nox(`Apresentacao ${String(i + 1).padStart(2, '0')}.jpg`)) },
      { grupo: 'posts', ratio: 4 / 5, titulo: 'Cuidados com a tatuagem', descricao: 'Carrossel com os cuidados do pós-tatuagem, de forma leve e bem-humorada, com gatos como personagens.',
        imagens: [1, 2, 3, 4, 5].map(n => nox(`Cuidados com a tatuagem ${n}.png`)) },
      { grupo: 'posts', ratio: 4 / 5, titulo: 'Mês do flash tattoo', descricao: 'Divulgação do mês do flash tattoo: chamada, promoção por tamanho da tatuagem e a cartela com os desenhos prontos.',
        imagens: [1, 2, 3].map(n => nox(`Flash Tattoo ${n}.png`)) },
      { grupo: 'impressos', tipo: 'documento', ratio: 3748 / 2508, titulo: 'Cartão de visita', descricao: 'Cartão de visita escuro, com o logotipo em relevo e o crânio da gata no verso.',
        imagens: [nox('Cartão de visita.jpg')] }
    ]
  },
  {
    slug: 'atelie-da-min',
    titulo: 'Ateliê da Min',
    categoria: 'Criações pessoais',
    subtitulo: 'Estudos de caso',
    tint: 'pink',
    bg: '#FFF9EA',
    capa: BASE_ESTUDOS + 'Banner Ateliê da Min.png',
    pos: '50% 40%',
    resumo: 'Briefings criados por mim, sem cliente e sem limites, para treinar direção de arte do começo ao fim.',
    texto: [
      'O <strong>Ateliê da Min</strong> é o meu espaço de <strong>criações pessoais (Projetos ficticios):</strong> estudos de caso em que eu mesma escrevo o briefing, com formato, objetivo e copy, e depois desenho a solução visual.',
      'São quatro casos: <strong>Maxi Supermercados, Ápice Academia, Vértice Imóveis e Fogão da Roça,</strong> com posts, stories, anúncio e até um outdoor. Clique num item pra ver.'
    ],
    cliente: 'Estudos de caso (projetos fictícios)',
    servicos: 'Direção de arte · Social media · Anúncios · Outdoor',
    ano: '2024',
    grupos: {
      maxi:    { titulo: 'Maxi Supermercados', dica: 'Briefing: post estático informativo, 1080 x 1080 px' },
      apice:   { titulo: 'Ápice Academia',     dica: 'Briefing: anúncio comercial, feed 1080 x 1080 px e story 1080 x 1920 px' },
      vertice: { titulo: 'Vértice Imóveis',    dica: 'Briefing: comercial + informativo, feed 1080 x 1080 px e outdoor 900 x 300 cm' },
      fogao:   { titulo: 'Fogão da Roça',      dica: 'Posts e stories de um restaurante de comida mineira' }
    },
    secoes: [
      { grupo: 'maxi', ratio: 1, titulo: 'Benefícios da melancia no verão', descricao: 'Post informativo em formato de lista: hidrata, tem poucas calorias, ajuda na digestão e muito mais, com chamada para a próxima fruta da série.',
        tipo: 'documento', imagens: [BASE_ESTUDOS + 'Maxi Supermercados - Feed.png'] },
      { grupo: 'apice', ratio: 1, titulo: 'Projeto verão — feed', descricao: 'Anúncio comercial em roxo e amarelo, com a atleta em destaque e o preço a partir de R$ 69,90.',
        tipo: 'documento', imagens: [ec('Ápice Academia', 'Ápice Academia - Feed.png')] },
      { grupo: 'apice', ratio: 9 / 16, titulo: 'Projeto verão — story', descricao: 'Versão vertical do anúncio, com a logo no topo e a oferta no rodapé.',
        tipo: 'documento', imagens: [ec('Ápice Academia', 'Ápice Academia - Story.png')] },
      { grupo: 'vertice', ratio: 1, titulo: 'Seu futuro — feed', descricao: 'Post quadrado com a casa ao entardecer, a chamada “Está na hora de pensar no seu futuro” e o contato em destaque.',
        tipo: 'documento', imagens: [ec('Vértice Imóveis', 'Vértice Imóveis - Feed.png')] },
      { grupo: 'vertice', ratio: 3402 / 1134, titulo: 'Seu futuro — outdoor', descricao: 'Versão panorâmica para outdoor (900 x 300 cm), com a mesma chamada sobre a fotografia da casa.',
        tipo: 'documento', imagens: [ec('Vértice Imóveis', 'Vértice Imóveis - Banner.png')] },
      { grupo: 'fogao', ratio: 4 / 5, titulo: 'Posts do Fogão da Roça', descricao: 'Série de feed com horário de funcionamento, “Bateu aquela fome?”, endereço e cardápio, em marrom e dourado.',
        imagens: [1, 2, 3, 4].map(n => ec('Fogão da Roça', `Fogão da Roça - Feed ${n}.png`)) },
      { grupo: 'fogao', ratio: 9 / 16, titulo: 'Stories do Fogão da Roça', descricao: 'A mesma série em formato vertical: horário, chamada, localização e cardápio com preços.',
        imagens: [1, 2, 3, 4].map(n => ec('Fogão da Roça', `Fogão da Roça - Story ${n}.png`)) }
    ]
  }
];


/* ==========================================================
   Código da galeria (não precisa mexer daqui para baixo)
   ========================================================== */
(function () {
  const $ = id => document.getElementById(id);
  if (!$('stage') || !$('modal')) return;   // fora da página da galeria (ex.: home), não faz nada
  const stage = $('stage'), filtersEl = $('filters'), countEl = $('count'), dotsEl = $('dots');
  const btnPrev = $('c-prev'), btnNext = $('c-next');
  const modal = $('modal'), panel = modal.querySelector('.modal__panel');
  const src = p => encodeURI(p);
  /* AJUDA: se uma imagem não carregar, o console (F12) mostra o caminho exato que o navegador tentou abrir */
  addEventListener('error', e => {
    if (e.target && e.target.tagName === 'IMG') console.warn('Imagem NÃO encontrada:', decodeURI(e.target.getAttribute('src')));
  }, true);
  const pad = n => String(n).padStart(2, '0');
  const cats = p => [].concat(p.categoria);          // categoria pode ser texto ou lista

  let filtro = 'Todos';
  let lista = PROJETOS.slice();   // projetos do filtro atual, na ordem do carrossel
  let pos = 0;                    // posição (na lista) do projeto que está no meio
  let atual = null;               // projeto aberto na janela
  let empilhou = false;           // true se abrimos a janela com pushState (então "fechar" = voltar)
  let ultimoFoco = null;
  const anterior = PROJETOS.map(() => null);   // última posição de cada card (para não "voar" ao dar a volta)

  /* ---------- cards ---------- */
  const cards = PROJETOS.map(p => {
    const a = document.createElement('a');
    a.className = `proj proj--${p.tint}`;
    a.href = '#' + p.slug;
    a.dataset.slug = p.slug;
    a.draggable = false;
    a.style.setProperty('--pos', p.pos || '50% 50%');
    a.innerHTML = `
      <div class="proj__media">
        <img src="${src(p.capa)}" alt="Capa do projeto ${p.titulo}" draggable="false">
        <div class="proj__hover"><span>${p.resumo}</span></div>
      </div>
      <div class="proj__meta">
        <div><span class="proj__tag">${cats(p).join(' · ')}</span><h3>${p.titulo}</h3></div>
        <span class="proj__go" aria-hidden="true">↗</span>
      </div>`;
    stage.appendChild(a);
    return a;
  });

  /* ---------- posição dos cards ---------- */
  function render() {
    const n = lista.length;
    cards.forEach((el, k) => {
      const idx = lista.indexOf(PROJETOS[k]);
      if (idx < 0) { el.hidden = true; anterior[k] = null; return; }
      el.hidden = false;

      let d = idx - pos;                                   // distância até o meio, pelo caminho mais curto
      if (n > 1) { d = ((d % n) + n) % n; if (d > n / 2) d -= n; }
      const a = Math.abs(d);

      // quem dá a volta de um lado ao outro troca de lugar sem animar
      const pulo = anterior[k] !== null && Math.abs(d - anterior[k]) > 2;
      if (pulo) el.style.transition = 'none';
      el.style.setProperty('--d', d);
      el.style.setProperty('--a', Math.min(a, 3));
      if (pulo) { void el.offsetWidth; el.style.transition = ''; }
      anterior[k] = d;

      el.dataset.a = a;
      el.classList.toggle('is-active', d === 0);
      el.classList.toggle('is-far', a > 2);
      el.tabIndex = d === 0 ? 0 : -1;
      el.setAttribute('aria-hidden', a > 2 ? 'true' : 'false');
    });

    countEl.textContent = pad(pos + 1) + ' / ' + pad(n);
    dotsEl.querySelectorAll('button').forEach((b, i) => {
      b.classList.toggle('is-active', i === pos);
      b.setAttribute('aria-current', i === pos ? 'true' : 'false');
    });
    btnPrev.disabled = btnNext.disabled = n < 2;
  }

  function go(dir) {
    const n = lista.length;
    if (n < 2) return;
    pos = (pos + dir + n) % n;
    render();
  }

  btnPrev.addEventListener('click', () => go(-1));
  btnNext.addEventListener('click', () => go(1));

  /* ---------- filtros ---------- */
  const categorias = ['Todos', ...new Set(PROJETOS.flatMap(cats))];
  categorias.forEach(c => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = c;
    b.className = c === filtro ? 'is-active' : '';
    b.setAttribute('aria-pressed', c === filtro);
    b.addEventListener('click', () => aplicarFiltro(c));
    filtersEl.appendChild(b);
  });

  function visiveis() { return lista; }

  function aplicarFiltro(c) {
    filtro = c;
    lista = PROJETOS.filter(p => c === 'Todos' || cats(p).includes(c));
    pos = 0;
    filtersEl.querySelectorAll('button').forEach(b => {
      const on = b.textContent === c;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-pressed', on);
    });
    dotsEl.innerHTML = '';
    lista.forEach((p, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-label', 'Ver ' + p.titulo);
      b.addEventListener('click', () => { pos = i; render(); });
      dotsEl.appendChild(b);
    });
    anterior.fill(null);
    render();
    stage.classList.remove('is-refresh'); void stage.offsetWidth; stage.classList.add('is-refresh');
  }
  aplicarFiltro('Todos');

  /* ---------- arrastar / deslizar, teclado e trackpad ---------- */
  let inicioX = 0, arrastando = false, moveu = false;

  stage.addEventListener('pointerdown', e => {
    if (e.button) return;
    inicioX = e.clientX; arrastando = true; moveu = false;
  });
  stage.addEventListener('pointermove', e => {
    if (!arrastando) return;
    if (Math.abs(e.clientX - inicioX) > 8) { moveu = true; stage.classList.add('is-drag'); }
  });
  function soltar(e) {
    if (!arrastando) return;
    arrastando = false;
    stage.classList.remove('is-drag');
    const dx = e.clientX - inicioX;
    if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
  }
  stage.addEventListener('pointerup', soltar);
  stage.addEventListener('pointercancel', () => { arrastando = false; moveu = false; stage.classList.remove('is-drag'); });
  stage.addEventListener('pointerleave', e => { if (arrastando && e.pointerType === 'mouse') soltar(e); });

  addEventListener('keydown', e => {
    if (!modal.hidden || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === 'ArrowRight') go(1);
    else if (e.key === 'ArrowLeft') go(-1);
  });

  let ultimoWheel = 0;
  stage.addEventListener('wheel', e => {
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) || Math.abs(e.deltaX) < 20) return;
    e.preventDefault();
    const agora = Date.now();
    if (agora - ultimoWheel < 600) return;
    ultimoWheel = agora;
    go(e.deltaX > 0 ? 1 : -1);
  }, { passive: false });

  /* clique: card do lado vira o do meio; card do meio abre o projeto */
  stage.addEventListener('click', e => {
    const a = e.target.closest('.proj');
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
    e.preventDefault();
    if (moveu) { moveu = false; return; }          // foi um arraste, não um clique
    const p = PROJETOS.find(x => x.slug === a.dataset.slug);
    const i = lista.indexOf(p);
    if (i !== pos) { pos = i; render(); return; }
    history.pushState(null, '', '#' + p.slug);
    empilhou = true;
    abrir(p);
  });

  /* ---------- janela do projeto ---------- */
  const mImg = $('m-img'), mThumbs = $('m-thumbs');

  function trocarImagem(url, alt) {
    mImg.classList.add('is-swap');
    setTimeout(() => {
      mImg.src = src(url);
      mImg.alt = alt;
      mImg.classList.remove('is-swap');
    }, 180);
  }

  /* ---------- posts do projeto (grade + carrossel) ---------- */
  const sStrip = $('s-strip'), sCount = $('s-count'), sActions = $('s-actions');
  const sPrev = $('s-prev'), sNext = $('s-next');
  const sIndex = $('s-index'), sViewer = $('s-viewer'), mSimple = $('m-simple');
  const ICONE_CARROSSEL = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M8 3h11a2 2 0 0 1 2 2v11h-2V5H8V3Zm-3 3h11a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z"/></svg>';

  function montarSecoes(p) {
    // sem "grupos": uma lista só, com o subtítulo do projeto
    const grupos = p.grupos || { _: { titulo: p.subtitulo || 'Posts', dica: 'Clique num post para ver o carrossel completo' } };
    const chaves = Object.keys(grupos);
    sIndex.innerHTML = '';
    const listas = {};
    chaves.forEach(k => {
      const g = document.createElement('div');
      g.className = 'secs__group';
      g.innerHTML = `<h4 class="secs__sub">${grupos[k].titulo}</h4><p class="secs__hint">${grupos[k].dica || ''}</p>`;
      const ul = document.createElement('ul');
      ul.className = 'posts';
      g.appendChild(ul);
      listas[k] = ul;
      sIndex.appendChild(g);
    });
    p.secoes.forEach((s, i) => {
      const ul = listas[s.grupo] || listas[chaves[0]];
      const n = s.imagens.length;
      const legenda = s.pdf ? `PDF · ${s.paginas || ''} páginas`.replace('  ', ' ') : (s.tipo === 'documento' ? 'Documento' : `${n} slides`);
      const capa = s.miniatura || s.imagens[0];
      const icone = s.pdf ? '<span class="post__icon post__icon--txt">PDF</span>'
        : (s.tipo !== 'documento' && n > 1 ? `<span class="post__icon">${ICONE_CARROSSEL}</span>` : '');
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-label', `Abrir: ${s.titulo} (${legenda})`);
      b.innerHTML = `
        <span class="post__img${s.ajuste === 'contain' ? ' is-contain' : ''}"${s.corMiniatura ? ` style="background:${s.corMiniatura}"` : ''}>
          ${capa ? `<img src="${src(capa)}" alt="" loading="lazy" draggable="false">` : ''}
          ${icone}
          <span class="post__go" aria-hidden="true">↗</span>
        </span>
        <span class="post__cap"><strong>${s.titulo}</strong><small>${legenda}</small></span>`;
      b.addEventListener('click', () => abrirSecao(p, i));
      li.appendChild(b);
      ul.appendChild(li);
    });
    chaves.forEach(k => { if (!listas[k].children.length) listas[k].parentElement.remove(); });
    $('s-back').onclick = mostrarIndice;
    $('s-back').setAttribute('aria-label', 'Voltar para ' + (p.subtitulo || 'os posts'));
    $('s-back').title = 'Voltar para ' + (p.subtitulo || 'os posts');
    mostrarIndice();
  }

  /* estado 1: capa grande + grade de posts */
  function mostrarIndice() {
    sViewer.hidden = true;
    panel.classList.remove('is-viewing');
    sIndex.hidden = false;
    mSimple.hidden = false;
    panel.scrollTop = 0;
  }

  /* estado 2: carrossel do post escolhido */
  function abrirSecao(p, i) {
    const s = p.secoes[i];
    $('s-title').textContent = s.titulo;
    $('s-desc').textContent = s.descricao || '';
    $('s-desc').hidden = !s.descricao;
    const n = s.imagens.length;
    sViewer.style.setProperty('--rn', s.ratio || 0.75);   // proporção dos slides (largura / altura)
    sViewer.classList.toggle('is-pdf', !!s.pdf);
    if (s.pdf) {
      sStrip.innerHTML = `<iframe src="${src(s.pdf)}#view=FitH&toolbar=0&navpanes=0" title="${s.titulo}"></iframe>`;
      sActions.innerHTML = `<a class="btn btn--green" href="${src(s.pdf)}" target="_blank" rel="noopener">abrir em nova aba</a>`
        + `<a class="btn btn--red" href="${src(s.pdf)}" download>baixar PDF</a>`;
    } else {
      sStrip.innerHTML = s.imagens.map((u, k) => /\.(mp4|webm)$/i.test(u)
        ? `<video src="${src(u)}" style="flex:none;width:100%;aspect-ratio:var(--rn,.75);object-fit:cover;scroll-snap-align:start;scroll-snap-stop:always" controls muted loop playsinline preload="metadata" aria-label="${p.titulo}: ${s.titulo}, slide ${k + 1} de ${n} (vídeo)"></video>`
        : `<img src="${src(u)}" alt="${p.titulo}: ${s.titulo}${n > 1 ? `, slide ${k + 1} de ${n}` : ''}" draggable="false"${k > 1 ? ' loading="lazy"' : ''}>`
      ).join('');
      sActions.innerHTML = '';
    }
    sActions.hidden = !s.pdf;
    sStrip.scrollLeft = 0;
    sDots.innerHTML = '';
    for (let k = 0; k < (s.pdf ? 0 : n); k++) {
      const d = document.createElement('button');
      d.type = 'button';
      d.setAttribute('aria-label', `Ir para o slide ${k + 1} de ${n}`);
      d.addEventListener('click', () => irPara(k));
      sDots.appendChild(d);
    }
    mSimple.hidden = true;
    sIndex.hidden = true;
    sViewer.hidden = false;
    panel.classList.add('is-viewing');   // esconde o anterior/próximo projeto para o post caber na tela
    sStrip.classList.remove('is-refresh'); void sStrip.offsetWidth; sStrip.classList.add('is-refresh');
    panel.scrollTop = 0;
    atualizarFaixa();
    $('s-back').focus({ preventScroll: true });
  }

  const sDots = $('s-dots');

  function atualizarFaixa() {
    const n = sStrip.children.length;
    if (!n) return;
    const i = Math.min(n - 1, Math.max(0, Math.round(sStrip.scrollLeft / (sStrip.clientWidth || 1))));
    sCount.textContent = (i + 1) + '/' + n;
    sDots.querySelectorAll('button').forEach((d, k) => {
      d.classList.toggle('is-active', k === i);
      d.setAttribute('aria-current', k === i ? 'true' : 'false');
    });
    sPrev.classList.toggle('is-off', i === 0);
    sNext.classList.toggle('is-off', i === n - 1);
    sViewer.classList.toggle('is-single', n < 2);
  }

  function irPara(i) {
    sStrip.scrollTo({ left: i * sStrip.clientWidth, behavior: 'smooth' });
  }

  function rolarFaixa(dir) {
    const n = sStrip.children.length;
    const i = Math.round(sStrip.scrollLeft / (sStrip.clientWidth || 1));
    irPara(Math.min(n - 1, Math.max(0, i + dir)));
  }

  sPrev.addEventListener('click', () => rolarFaixa(-1));
  sNext.addEventListener('click', () => rolarFaixa(1));
  sStrip.addEventListener('scroll', () => requestAnimationFrame(atualizarFaixa), { passive: true });
  addEventListener('resize', atualizarFaixa);
  sStrip.addEventListener('load', atualizarFaixa, true);   // as imagens terminam de carregar depois

  /* Imagem grande da janela: preenche a moldura inteira (sem faixas vazias nas laterais/em cima).
     A moldura assume a proporção da própria imagem; nos álbuns vale o "ratio" de cada imagem.
     Se a imagem for muito alta, ela é cortada de leve (altura máxima abaixo). */
  const mStage = $('m-stage');
  const recorte = p => p && p.capaAjuste === 'recorte';   // projeto que mostra o mesmo recorte do card (ex.: Gastrofood)
  mImg.addEventListener('load', () => {
    if (atual && ((atual.album && atual.album.length) || recorte(atual))) return;
    if (mImg.naturalWidth) mStage.style.aspectRatio = mImg.naturalWidth + ' / ' + mImg.naturalHeight;
  });

  function preencher(p, animar) {
    atual = p;
    $('m-tag').textContent = cats(p).join(' · ');
    $('m-title').textContent = p.titulo;
    $('m-text').innerHTML = p.texto.map(t => `<p>${t}</p>`).join('');
    $('m-stage').style.setProperty('--bg', p.bg || '#333');

    const fatos = [['Cliente', p.cliente], ['Serviços', p.servicos], ['Ano', p.ano]].filter(f => f[1]);
    $('m-facts').innerHTML = fatos.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
    $('m-facts').hidden = !fatos.length;

    const alt = `Projeto ${p.titulo}`;
    const comSecoes = !!(p.secoes && p.secoes.length);
    panel.classList.toggle('is-sections', comSecoes);
    $('m-sections').hidden = !comSecoes;
    mSimple.hidden = false;
    $('m-simple').classList.toggle('so-capa', comSecoes);
    const album = p.album && p.album.length ? p.album : null;
    const fotos = album ? album.map(a => a.imagem) : (p.imagens || []);
    const grande = comSecoes ? [p.capa] : fotos;
    $('m-simple').classList.toggle('so-album', !!album);

    mThumbs.innerHTML = '';
    const altDe = i => album ? `${p.titulo}: ${album[i].rotulo}` : alt;
    const moldura = i => { $('m-stage').style.aspectRatio = (album && album[i].ratio) || ''; };
    moldura(0);
    mImg.style.objectFit = 'cover';
    mImg.style.objectPosition = recorte(p) ? (p.pos || '50% 50%') : '';
    mStage.style.maxHeight = recorte(p) ? '' : 'calc(100vh - 150px)';
    if (recorte(p)) mStage.style.aspectRatio = '514 / 340';   // mesma proporção do card
    if (animar) trocarImagem(grande[0], altDe(0)); else { mImg.src = src(grande[0]); mImg.alt = altDe(0); }
    if (comSecoes) {
      montarSecoes(p);
    } else if (fotos.length > 1) {
      fotos.forEach((url, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = i === 0 ? 'is-active' : '';
        b.setAttribute('aria-label', album ? `Ver ${album[i].rotulo}` : `Ver imagem ${i + 1} de ${fotos.length}`);
        b.innerHTML = `<img src="${src(url)}" alt="" loading="lazy">` + (album ? `<span>${album[i].rotulo}</span>` : '');
        b.addEventListener('click', () => {
          mThumbs.querySelectorAll('button').forEach(x => x.classList.toggle('is-active', x === b));
          trocarImagem(url, altDe(i));
          moldura(i);
        });
        mThumbs.appendChild(b);
      });
    } else {
      mThumbs.innerHTML = '<div class="ph">mais imagens deste projeto entram aqui</div>';
    }

    const itens = visiveis(), i = itens.indexOf(p);
    const prev = itens[(i - 1 + itens.length) % itens.length];
    const next = itens[(i + 1) % itens.length];
    $('m-prev-t').textContent = prev.titulo;
    $('m-next-t').textContent = next.titulo;
    $('m-prev').setAttribute('aria-label', 'Projeto anterior: ' + prev.titulo);
    $('m-next').setAttribute('aria-label', 'Próximo projeto: ' + next.titulo);
    $('m-prev').onclick = () => ir(prev);
    $('m-next').onclick = () => ir(next);
    $('m-count').textContent = pad(i + 1) + ' / ' + pad(itens.length);
    $('m-cta').href = linkWhats(p);
    panel.scrollTop = 0;
  }

  function abrir(p) {
    if (!p) return;
    // se o projeto não está no filtro atual (link direto), volta para "Todos"
    if (!visiveis().includes(p)) aplicarFiltro('Todos');
    const jaAberta = !modal.hidden;
    if (!jaAberta) ultimoFoco = document.activeElement;
    preencher(p, jaAberta);
    // o carrossel acompanha o projeto aberto (link direto, anterior/próximo da janela)
    const k = lista.indexOf(p);
    if (k >= 0 && k !== pos) { pos = k; render(); }
    if (jaAberta) return;
    modal.hidden = false;
    document.documentElement.classList.add('no-scroll');
    requestAnimationFrame(() => requestAnimationFrame(() => modal.classList.add('is-open')));
    modal.querySelector('.modal__close').focus({ preventScroll: true });
  }

  function ir(p) {                       // anterior / próximo: troca o hash sem empilhar histórico
    history.replaceState(null, '', '#' + p.slug);
    abrir(p);
  }

  function fecharJanela() {
    if (modal.hidden) return;
    modal.classList.remove('is-open');
    document.documentElement.classList.remove('no-scroll');
    setTimeout(() => { if (!modal.classList.contains('is-open')) modal.hidden = true; }, 350);
    if (ultimoFoco && ultimoFoco.focus) ultimoFoco.focus({ preventScroll: true });
  }

  function fechar() {
    if (modal.hidden) return;
    if (empilhou) { empilhou = false; history.back(); return; }   // o popstate fecha
    history.replaceState(null, '', location.pathname + location.search);
    fecharJanela();
  }

  modal.addEventListener('click', e => { if (e.target.closest('[data-close]')) fechar(); });

  addEventListener('keydown', e => {
    if (modal.hidden) return;
    if (e.key === 'Escape') fechar();
    else if (e.key === 'ArrowRight') { if (!sViewer.hidden) rolarFaixa(1); else $('m-next').click(); }
    else if (e.key === 'ArrowLeft')  { if (!sViewer.hidden) rolarFaixa(-1); else $('m-prev').click(); }
    else if (e.key === 'Tab') {            // mantém o foco dentro da janela
      const f = [...modal.querySelectorAll('button, a[href]')].filter(x => x.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  /* ---------- link direto (galeria.html#slug) e botão voltar ---------- */
  function sincronizar() {
    const p = PROJETOS.find(x => '#' + x.slug === location.hash);
    if (p) abrir(p); else fecharJanela();
  }
  addEventListener('popstate', sincronizar);
  if (location.hash) sincronizar();
})();


/* ==========================================================
   Menu lateral (sidebar) para tablet e celular
   Montado a partir do próprio menu do cabeçalho: se você mudar os links
   no HTML, o menu lateral acompanha sozinho. Funciona em todas as páginas.
   Abaixo de 1000px o menu normal some e aparece o botão de 3 risquinhas.
   ========================================================== */
(function () {
  const topbar = document.querySelector('.topbar');
  const nav = topbar && topbar.querySelector('.nav');
  if (!topbar || !nav) return;

  const mq = matchMedia('(min-width: 1001px)');

  /* botão (3 risquinhas) no cabeçalho */
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'menu-toggle';
  toggle.setAttribute('aria-label', 'Abrir menu');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', 'drawer');
  toggle.innerHTML = '<span></span><span></span><span></span>';
  topbar.appendChild(toggle);

  /* painel lateral */
  const drawer = document.createElement('div');
  drawer.className = 'drawer';
  drawer.id = 'drawer';
  drawer.setAttribute('inert', '');
  drawer.innerHTML = `
    <div class="drawer__backdrop" data-close></div>
    <aside class="drawer__panel" role="dialog" aria-modal="true" aria-label="Menu">
      <button type="button" class="drawer__close" data-close aria-label="Fechar menu">×</button>
      <nav class="drawer__nav" aria-label="Menu lateral"></nav>
      <div class="drawer__social"></div>
    </aside>`;
  document.body.appendChild(drawer);

  const drawerNav = drawer.querySelector('.drawer__nav');
  const social = drawer.querySelector('.drawer__social');

  nav.querySelectorAll('a').forEach((a, i) => {
    const l = document.createElement('a');
    l.href = a.getAttribute('href');
    l.textContent = a.textContent.trim();
    l.style.setProperty('--i', i);
    l.dataset.href = a.getAttribute('href');
    drawerNav.appendChild(l);
  });

  topbar.querySelectorAll('.icon-btn').forEach(a => {
    const b = document.createElement('a');
    b.className = 'drawer__btn';
    b.href = a.getAttribute('href');
    b.setAttribute('aria-label', a.getAttribute('aria-label') || '');
    const img = a.querySelector('img');
    if (img) { const c = document.createElement('img'); c.src = img.getAttribute('src'); c.alt = ''; b.appendChild(c); }
    const nome = document.createElement('span');          // nome ao lado do ícone (WhatsApp, Instagram)
    nome.textContent = a.getAttribute('aria-label') || '';
    b.appendChild(nome);
    social.appendChild(b);
  });

  /* copia o item ativo do menu do cabeçalho (na home ele muda ao rolar) */
  function syncActive() {
    const act = nav.querySelector('a.is-active');
    drawerNav.querySelectorAll('a').forEach(l => {
      const on = !!act && l.dataset.href === act.getAttribute('href');
      l.classList.toggle('is-active', on);
      if (on) l.setAttribute('aria-current', 'page'); else l.removeAttribute('aria-current');
    });
  }

  function abrir() {
    syncActive();
    drawer.removeAttribute('inert');
    drawer.classList.add('is-open');
    document.documentElement.classList.add('menu-open');
    toggle.setAttribute('aria-expanded', 'true');
    drawer.querySelector('.drawer__close').focus({ preventScroll: true });
  }

  function fechar(devolverFoco = true) {
    if (!drawer.classList.contains('is-open')) return;
    drawer.classList.remove('is-open');
    drawer.setAttribute('inert', '');
    document.documentElement.classList.remove('menu-open');
    toggle.setAttribute('aria-expanded', 'false');
    if (devolverFoco) toggle.focus({ preventScroll: true });
  }

  toggle.addEventListener('click', abrir);
  drawer.addEventListener('click', e => {
    if (e.target.closest('[data-close]')) fechar();
    else if (e.target.closest('.drawer__nav a')) fechar(false);   // o link continua e rola até a seção
  });

  addEventListener('keydown', e => {
    if (!drawer.classList.contains('is-open')) return;
    if (e.key === 'Escape') { fechar(); return; }
    if (e.key === 'Tab') {                  // mantém o foco dentro do painel
      const f = [...drawer.querySelectorAll('button, a[href]')];
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  /* se a tela crescer até o desktop, fecha o painel */
  mq.addEventListener('change', e => { if (e.matches) fechar(false); });
})();

/* Botão "zap" (só existe em algumas páginas): se não existir, não faz nada */
const zap = document.getElementById("zap");
if (zap) {
  const msg = "Olá Min, vim pelo seu portfólio! Gostaria de mais informações.";
  zap.href = "https://wa.me/5511965270351?text=" + encodeURIComponent(msg);
}