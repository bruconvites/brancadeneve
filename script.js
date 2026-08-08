/* ==========================================================
   ESPELHO MÁGICO
   script.js
   Compatível com index.html e style.css já existentes.
   Não recria nenhum elemento — apenas usa os IDs já definidos.
========================================================== */

(function () {
    'use strict';

    /* ======================================================
    ELEMENTOS
    ====================================================== */

    var video        = document.getElementById('camera');
    var selfieFreeze  = document.getElementById('selfieFreeze');
    var fogCanvas     = document.getElementById('fogCanvas');
    var ctx           = fogCanvas.getContext('2d');
    var frame         = document.getElementById('frame');
    var fogImage      = document.getElementById('fogImage');

    var welcome       = document.getElementById('welcome');
    var startButton   = document.getElementById('startButton');

    var photoButton   = document.getElementById('photoButton');
    var flash         = document.getElementById('flash');

    var preview       = document.getElementById('preview');
    var photoResult   = document.getElementById('photoResult');
    var savePhoto     = document.getElementById('savePhoto');
    var closePreview  = document.getElementById('closePreview');

    var loader        = document.getElementById('loader');

    var errorBox      = document.getElementById('errorBox');
    var errorText     = document.getElementById('errorText');
    var closeError    = document.getElementById('closeError');

    var scene2Text    = document.getElementById('scene2Text');
    var scene2Line1   = document.getElementById('scene2Line1');
    var scene2Line2   = document.getElementById('scene2Line2');
    var goldGlow      = document.getElementById('goldGlow');
    var revealImg     = document.getElementById('revealImg');
    var scene3Glow    = document.getElementById('scene3Glow');
    var sceneVideo    = document.getElementById('sceneVideo');
    var unmuteHint    = document.getElementById('unmuteHint');
    var appEl         = document.getElementById('app');

    var inviteImg     = document.getElementById('inviteImg');
    var pixButton     = document.getElementById('pixButton');
    var pixToast      = document.getElementById('pixToast');

    /* ======================================================
    CONFIGURAÇÃO

    "primeira.jpg" (moldura) é uma imagem opaca — já vem com o
    vidro do espelho e o texto desenhados dentro dela. Para que
    a câmera e o embaçado (canvas) apareçam por baixo, recortamos
    aqui um oval transparente exatamente onde fica o vidro.

    "embaçado.png" agora é um PNG de verdade, com transparência
    real — só o oval de névoa é visível, o resto é transparente.

    As medidas abaixo (em pixels de cada imagem original) foram
    tiradas manualmente/por análise de cor sobre as duas artes.
    Ajuste se um dia alguma das imagens for trocada de novo.
    ====================================================== */

    var FRAME_IMG = {
        w:  1063,
        h:  1890,
        cx: 527,   // centro do oval do vidro (x)
        cy: 1291,  // centro do oval do vidro (y)
        rx: 279,   // raio horizontal do vidro
        ry: 394    // raio vertical do vidro
    };

    var FOG_IMG = {
        w:  1063,
        h:  1890,
        cx: 526,   // centro do oval de névoa (x)
        cy: 1294,  // centro do oval de névoa (y)
        rx: 288,   // raio horizontal da névoa
        ry: 408    // raio vertical da névoa
    };

    /* ------------------------------------------------------
    CENA 5 — CONVITE (interativo.jpg) E BOTÃO DO PIX

    PIX_BOX descreve, em pixels da própria imagem interativo.jpg,
    o retângulo onde fica desenhada a caixa "Pix presente". O
    botão invisível é posicionado exatamente ali, acompanhando
    qualquer tamanho de tela (mesma lógica usada no oval do
    espelho). Se um dia a imagem do convite mudar de layout,
    ajuste esses números.
    ------------------------------------------------------ */

    var INVITE_IMG = {
        w: 941,
        h: 1672
    };

    var PIX_BOX = {
        left:   518,
        top:    1262,
        right:  858,
        bottom: 1498
    };

    var PIX_KEY =
        '00020126360014BR.GOV.BCB.PIX0114+55419956533905204000053039865802BR5920Bruna Karla de Souza6009SAO PAULO621405103l41qsXkTx6304919F';

    var ERASE_RADIUS = 28; // "grossura do dedo" em px de tela

    /* ======================================================
    NARRAÇÃO / TEXTOS DAS PRÓXIMAS CENAS

    Cada fala tem um texto (sempre aparece na tela) e um
    "audioSrc" opcional. Se um dia você gravar áudios de
    verdade, é só colocar o arquivo na pasta do projeto e
    escrever o nome aqui — o site passa a tocar o áudio
    gravado no lugar da voz sintética do celular, sem precisar
    mexer em mais nada.
    ====================================================== */

    var NARRATION = {

        mirrorQuestion: {
            text: 'Espelho, espelho meu... existe alguém mais belo?',
            gender: 'female',
            audioSrc: null // ex: 'audio/voz-feminina-pergunta.mp3'
        },

        mirrorAnswer: {
            text: 'Minha rainha, essa pessoa é linda... mas existe uma princesa ainda mais bela e encantadora.',
            gender: 'male',
            audioSrc: null // ex: 'audio/voz-masculina-resposta.mp3'
        },

        forestPart1: {
            text: 'E assim, a escolhida pelo espelho inicia sua jornada por um reino onde a magia vive em cada cantinho... Mas esta história está apenas começando.',
            gender: 'female',
            audioSrc: null
        },

        forestPart2: {
            text: 'Mas todo conto de fadas guarda um segredo... e este espelho ainda tem uma última revelação a fazer.',
            gender: 'female',
            audioSrc: null
        }

    };

    var dpr = Math.max(1, window.devicePixelRatio || 1);
    var stream = null;
    var drawing = false;
    var lastPoint = null;

    // posição do oval do vidro em px de tela (recalculada a cada resize)
    var oval = { cx: 0, cy: 0, rx: 0, ry: 0 };

    /* ======================================================
    UTILIDADES
    ====================================================== */

    function isIOS() {
        return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
            (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    }

    function showLoader(show) {
        loader.style.display = show ? 'flex' : 'none';
    }

    function showError(msg) {
        errorText.textContent = msg;
        errorBox.style.display = 'flex';
        showLoader(false);
    }

    var sceneVideoPreloaded = false;
    function preloadSceneVideo() {
        if (sceneVideoPreloaded) return;
        sceneVideoPreloaded = true;
        sceneVideo.preload = 'auto';
        sceneVideo.load();
    }

    function sleep(ms) {
        return new Promise(function (resolve) { setTimeout(resolve, ms); });
    }

    /* ======================================================
    NARRAÇÃO (voz)

    Toca um áudio gravado, se existir (line.audioSrc). Se não
    existir, usa a voz sintética do próprio navegador como
    substituta (Web Speech API) — funciona em Android e iPhone,
    mas a qualidade depende do celular de cada pessoa. Em
    último caso (sem suporte nenhum), só espera um tempo
    estimado pela quantidade de palavras, para o texto na tela
    continuar no ritmo certo.

    Sempre devolve uma Promise que resolve quando a fala acaba.
    ====================================================== */

    var voicesCache = null;

    function getVoices() {
        return new Promise(function (resolve) {
            if (!('speechSynthesis' in window)) { resolve([]); return; }

            var existing = window.speechSynthesis.getVoices();
            if (existing && existing.length) { resolve(existing); return; }

            var done = false;
            window.speechSynthesis.onvoiceschanged = function () {
                if (done) return;
                done = true;
                resolve(window.speechSynthesis.getVoices());
            };
            // alguns navegadores nunca disparam o evento — desiste depois de um tempo
            setTimeout(function () {
                if (done) return;
                done = true;
                resolve(window.speechSynthesis.getVoices());
            }, 600);
        });
    }

    function pickVoice(voices, gender) {

        if (!voices || !voices.length) return null;

        var ptVoices = voices.filter(function (v) {
            return /pt(-|_)?(BR|br|PT|pt)?/.test(v.lang);
        });

        var pool = ptVoices.length ? ptVoices : voices;

        var genderHints = gender === 'female'
            ? ['female', 'mulher', 'feminin', 'luciana', 'joana', 'maria', 'vitoria', 'vitória']
            : ['male', 'homem', 'masculin', 'daniel', 'felipe', 'ricardo', 'jorge'];

        var byHint = pool.filter(function (v) {
            var n = v.name.toLowerCase();
            return genderHints.some(function (h) { return n.indexOf(h) !== -1; });
        });

        return (byHint[0] || pool[0] || voices[0]);
    }

    function estimateSpeechMs(text) {
        var words = text.trim().split(/\s+/).length;
        return Math.max(1600, words * 380); // ritmo aproximado de leitura calma
    }

    function speakLine(line) {

        // 1) áudio gravado de verdade, se já existir
        if (line.audioSrc) {
            return new Promise(function (resolve) {
                var audio = new Audio(line.audioSrc);
                audio.addEventListener('ended', resolve);
                audio.addEventListener('error', function () {
                    resolve();
                });
                audio.play().catch(function () { resolve(); });
            });
        }

        // 2) voz sintética do navegador
        if ('speechSynthesis' in window) {
            return getVoices().then(function (voices) {
                return new Promise(function (resolve) {

                    var utter = new SpeechSynthesisUtterance(line.text);
                    utter.lang = 'pt-BR';
                    utter.rate = 0.94;
                    utter.pitch = line.gender === 'male' ? 0.85 : 1.08;

                    var voice = pickVoice(voices, line.gender);
                    if (voice) utter.voice = voice;

                    var resolved = false;
                    var finish = function () {
                        if (resolved) return;
                        resolved = true;
                        resolve();
                    };

                    utter.onend = finish;
                    utter.onerror = finish;

                    // salvaguarda: se a voz travar/não disparar evento nenhum
                    setTimeout(finish, estimateSpeechMs(line.text) + 1500);

                    try {
                        window.speechSynthesis.cancel();
                        window.speechSynthesis.speak(utter);
                    } catch (e) {
                        finish();
                    }
                });
            });
        }

        // 3) sem suporte nenhum: só espera um tempo estimado
        return sleep(estimateSpeechMs(line.text));
    }

    /* ======================================================
    MÁSCARA OVAL DA MOLDURA

    Recorta a moldura (#frame) para deixar transparente APENAS
    a área do vidro (um "buraco" oval), mantendo o resto da
    moldura (borda dourada + jardim) visível normalmente.

    Um clip-path simples do tipo ellipse() mantém visível SÓ
    o oval e apaga tudo em volta — o efeito contrário do que
    queremos. Por isso usamos uma máscara SVG: um retângulo do
    tamanho da tela, com um oval "furado" nele (regra evenodd).
    Isso sim mantém a moldura inteira e abre buraco só no vidro.
    ====================================================== */

    function ensureClipDefs() {
        if (document.getElementById('frameHoleClipPath')) return;

        var svgNS = 'http://www.w3.org/2000/svg';

        var svg = document.createElementNS(svgNS, 'svg');
        svg.setAttribute('width', '0');
        svg.setAttribute('height', '0');
        svg.style.position = 'absolute';
        svg.style.pointerEvents = 'none';

        var clipPath = document.createElementNS(svgNS, 'clipPath');
        clipPath.setAttribute('id', 'frameHoleClip');
        clipPath.setAttribute('clipPathUnits', 'userSpaceOnUse');

        var path = document.createElementNS(svgNS, 'path');
        path.setAttribute('id', 'frameHoleClipPath');
        path.setAttribute('fill-rule', 'evenodd');

        clipPath.appendChild(path);
        svg.appendChild(clipPath);
        document.body.appendChild(svg);
    }

    function updateFrameMask() {

        var w = window.innerWidth;
        var h = window.innerHeight;

        // mesmo fator de escala que o object-fit:cover usa
        var scale = Math.max(w / FRAME_IMG.w, h / FRAME_IMG.h);

        var rxPx = FRAME_IMG.rx * scale;
        var ryPx = FRAME_IMG.ry * scale;

        // a imagem fica centralizada na tela (object-fit:cover), então
        // um ponto que está deslocado do centro DA IMAGEM (como o vidro,
        // que agora fica mais para baixo por causa do texto) precisa
        // desse mesmo deslocamento aplicado a partir do centro da tela —
        // e não sempre exatamente no centro da tela.
        var cx = w / 2 + (FRAME_IMG.cx - FRAME_IMG.w / 2) * scale;
        var cy = h / 2 + (FRAME_IMG.cy - FRAME_IMG.h / 2) * scale;

        ensureClipDefs();

        // retângulo (tela toda) + oval do vidro, com regra evenodd:
        // o resultado é "tela inteira, exceto o oval" — o buraco certo
        var d =
            'M0,0 H' + w + ' V' + h + ' H0 Z ' +
            'M' + (cx - rxPx) + ',' + cy + ' ' +
            'A' + rxPx + ',' + ryPx + ' 0 1,0 ' + (cx + rxPx) + ',' + cy + ' ' +
            'A' + rxPx + ',' + ryPx + ' 0 1,0 ' + (cx - rxPx) + ',' + cy + ' Z';

        document.getElementById('frameHoleClipPath').setAttribute('d', d);

        var clip = 'url(#frameHoleClip)';

        frame.style.clipPath = clip;
        frame.style.webkitClipPath = clip;

        oval.cx = cx;
        oval.cy = cy;
        oval.rx = rxPx;
        oval.ry = ryPx;
    }

    /* ======================================================
    CANVAS DO EMBAÇADO
    ====================================================== */

    function resizeCanvas() {

        var w = window.innerWidth;
        var h = window.innerHeight;

        dpr = Math.max(1, window.devicePixelRatio || 1);

        fogCanvas.width  = Math.round(w * dpr);
        fogCanvas.height = Math.round(h * dpr);
        fogCanvas.style.width  = w + 'px';
        fogCanvas.style.height = h + 'px';

        // a partir daqui, 1 unidade = 1px CSS
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        updateFrameMask();

        // restringe todo o desenho (embaçado + apagar) à área do
        // vidro, exatamente onde a moldura deixa transparente
        ctx.beginPath();
        ctx.ellipse(oval.cx, oval.cy, oval.rx, oval.ry, 0, 0, Math.PI * 2);
        ctx.clip();

        drawFog();
    }

    function drawFog() {

        var w = window.innerWidth;
        var h = window.innerHeight;

        ctx.globalCompositeOperation = 'source-over';
        ctx.clearRect(0, 0, w, h);

        if (!fogImage.complete || !fogImage.naturalWidth) {
            return;
        }

        // em vez de simplesmente "cobrir a tela" com a imagem do
        // embaçado, aqui esticamos/posicionamos o embaçado.png de
        // forma que o OVAL DE NÉVOA dele caia exatamente em cima
        // do oval do vidro da moldura (oval.cx/cy/rx/ry) — assim
        // as duas artes sempre se alinham, mesmo com proporções
        // diferentes entre as duas imagens.
        var scaleX = oval.rx / FOG_IMG.rx;
        var scaleY = oval.ry / FOG_IMG.ry;

        var dw = FOG_IMG.w * scaleX;
        var dh = FOG_IMG.h * scaleY;
        var dx = oval.cx - FOG_IMG.cx * scaleX;
        var dy = oval.cy - FOG_IMG.cy * scaleY;

        ctx.drawImage(fogImage, dx, dy, dw, dh);
    }

    /* ======================================================
    APAGAR O EMBAÇADO COM O DEDO
    ====================================================== */

    function getPoint(src) {
        var rect = fogCanvas.getBoundingClientRect();
        return {
            x: src.clientX - rect.left,
            y: src.clientY - rect.top
        };
    }

    function eraseAt(p1, p2) {

        ctx.globalCompositeOperation = 'destination-out';
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = ERASE_RADIUS * 2;

        ctx.beginPath();

        if (p2) {
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
        } else {
            ctx.arc(p1.x, p1.y, ERASE_RADIUS, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function startDrawing(point) {
        drawing = true;
        lastPoint = point;
        eraseAt(point);
    }

    function continueDrawing(point) {
        if (!drawing) return;
        eraseAt(lastPoint, point);
        lastPoint = point;
    }

    function stopDrawing() {
        drawing = false;
        lastPoint = null;
    }

    // Pointer Events cobre mouse, caneta e toque em navegadores
    // modernos (Android e iOS 13+). Mantemos um fallback por
    // segurança em WebViews mais antigas.
    if (window.PointerEvent) {

        fogCanvas.addEventListener('pointerdown', function (e) {
            if (fogCanvas.setPointerCapture) {
                try { fogCanvas.setPointerCapture(e.pointerId); } catch (err) {}
            }
            startDrawing(getPoint(e));
        });

        fogCanvas.addEventListener('pointermove', function (e) {
            continueDrawing(getPoint(e));
        });

        fogCanvas.addEventListener('pointerup', stopDrawing);
        fogCanvas.addEventListener('pointercancel', stopDrawing);
        fogCanvas.addEventListener('pointerleave', stopDrawing);

    } else {

        fogCanvas.addEventListener('touchstart', function (e) {
            e.preventDefault();
            startDrawing(getPoint(e.touches[0]));
        }, { passive: false });

        fogCanvas.addEventListener('touchmove', function (e) {
            e.preventDefault();
            continueDrawing(getPoint(e.touches[0]));
        }, { passive: false });

        fogCanvas.addEventListener('touchend', stopDrawing);
        fogCanvas.addEventListener('touchcancel', stopDrawing);

        fogCanvas.addEventListener('mousedown', function (e) {
            startDrawing(getPoint(e));
        });
        fogCanvas.addEventListener('mousemove', function (e) {
            continueDrawing(getPoint(e));
        });
        fogCanvas.addEventListener('mouseup', stopDrawing);
    }

    /* ======================================================
    CÂMERA
    ====================================================== */

    function startCamera() {

        if (stream) return; // evita pedir a câmera duas vezes

        showLoader(true);

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            showError('Este navegador não suporta acesso à câmera.');
            return;
        }

        var constraints = {
            video: {
                facingMode: { ideal: 'user' },
                width:  { ideal: 1280 },
                height: { ideal: 1280 }
            },
            audio: false
        };

        navigator.mediaDevices.getUserMedia(constraints)
            .catch(function () {
                // tenta de novo sem exigir câmera frontal específica
                return navigator.mediaDevices.getUserMedia({ video: true, audio: false });
            })
            .then(function (s) {
                stream = s;
                video.srcObject = stream;

                video.onloadedmetadata = function () {
                    video.play().catch(function () {});
                    resizeCanvas();
                    showLoader(false);
                    photoButton.style.display = 'flex';
                };
            })
            .catch(function () {
                showLoader(false);
                showError('Não foi possível acessar a câmera. Verifique as permissões do navegador e tente novamente.');
            });
    }

    /* ======================================================
    TELA INICIAL

    Some automaticamente assim que a página carrega — a câmera
    já liga sozinha, sem precisar de um botão "Começar". O
    navegador ainda vai mostrar o próprio aviso de permissão de
    câmera (isso nenhum site consegue tirar), mas a nossa tela
    de instrução deixa de aparecer. A frase de abertura agora já
    vem desenhada na própria imagem da moldura.
    ====================================================== */

    function skipWelcomeScreen() {
        welcome.style.transition = 'none';
        welcome.style.display = 'none';
    }

    // mantém o botão funcionando também, caso algum navegador
    // bloqueie o início automático da câmera
    startButton.addEventListener('click', function () {
        welcome.classList.add('hide');
        startCamera();
    });

    /* ======================================================
    TIRAR E SALVAR SELFIE
    ====================================================== */

    // desenha "source" cobrindo todo o retângulo (cw x ch),
    // igual ao object-fit:cover do CSS. mirror=true espelha
    // horizontalmente (para bater com a câmera na tela).
    function drawCover(targetCtx, source, sw, sh, cw, ch, mirror) {

        var scale = Math.max(cw / sw, ch / sh);
        var dw = sw * scale;
        var dh = sh * scale;
        var dx = (cw - dw) / 2;
        var dy = (ch - dh) / 2;

        targetCtx.save();

        if (mirror) {
            targetCtx.translate(cw, 0);
            targetCtx.scale(-1, 1);
            targetCtx.drawImage(source, cw - dx - dw, dy, dw, dh);
        } else {
            targetCtx.drawImage(source, dx, dy, dw, dh);
        }

        targetCtx.restore();
    }

    photoButton.addEventListener('click', function () {

        var w = window.innerWidth;
        var h = window.innerHeight;
        var shotDpr = Math.min(dpr, 2);

        // ---- 1) congela só o retrato da câmera (para a Cena 2) ----
        var rawShot = document.createElement('canvas');
        rawShot.width  = Math.round(w * shotDpr);
        rawShot.height = Math.round(h * shotDpr);
        var rctx = rawShot.getContext('2d');
        rctx.setTransform(shotDpr, 0, 0, shotDpr, 0, 0);
        if (video.videoWidth) {
            drawCover(rctx, video, video.videoWidth, video.videoHeight, w, h, true);
        }
        var rawDataUrl = rawShot.toDataURL('image/png');

        // ---- 2) composição completa (câmera + embaçado + moldura),
        //         guardada para uso futuro (ex: salvar a selfie) ----
        var shot = document.createElement('canvas');
        shot.width  = Math.round(w * shotDpr);
        shot.height = Math.round(h * shotDpr);
        var sctx = shot.getContext('2d');
        sctx.setTransform(shotDpr, 0, 0, shotDpr, 0, 0);

        if (video.videoWidth) {
            drawCover(sctx, video, video.videoWidth, video.videoHeight, w, h, true);
        }
        sctx.drawImage(fogCanvas, 0, 0, w, h);
        sctx.save();
        sctx.beginPath();
        sctx.rect(0, 0, w, h);
        sctx.ellipse(oval.cx, oval.cy, oval.rx, oval.ry, 0, 0, Math.PI * 2, true);
        sctx.clip('evenodd');
        drawCover(sctx, frame, FRAME_IMG.w, FRAME_IMG.h, w, h, false);
        sctx.restore();

        photoResult.src = shot.toDataURL('image/png');

        // ---- 3) flash ----
        flash.style.transition = 'none';
        flash.style.opacity = '1';
        requestAnimationFrame(function () {
            flash.style.transition = 'opacity .4s';
            flash.style.opacity = '0';
        });

        // ---- 4) congela a câmera no lugar e esconde o botão ----
        photoButton.style.display = 'none';

        selfieFreeze.src = rawDataUrl;
        selfieFreeze.style.display = 'block';
        video.style.display = 'none';

        if (stream) {
            stream.getTracks().forEach(function (t) { t.stop(); });
        }

        // ---- 5) Cena 2 começa sozinha ----
        startScene2();
    });

    savePhoto.addEventListener('click', function () {

        var dataUrl = photoResult.src;
        if (!dataUrl) return;

        var filename = 'espelho-magico-' + Date.now() + '.png';

        if (isIOS()) {
            // iOS Safari geralmente não salva direto pelo atributo
            // "download" — abrimos a imagem numa nova aba para o
            // usuário tocar e segurar e escolher "Adicionar à Galeria"
            window.open(dataUrl, '_blank');
        } else {
            var link = document.createElement('a');
            link.href = dataUrl;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    });

    closePreview.addEventListener('click', function () {
        preview.style.display = 'none';
    });

    /* ======================================================
    ERRO
    ====================================================== */

    closeError.addEventListener('click', function () {
        errorBox.style.display = 'none';
    });

    /* ======================================================
    CENA 2 — O ESPELHO REVELA A ANIVERSARIANTE
    ====================================================== */

    function showScene2Line(el) {
        el.classList.add('show');
    }

    async function startScene2() {

        try {

            // pequena pausa dramática antes de tudo
            await sleep(900);

            // começa a carregar o vídeo da Cena 4 desde já, em segundo
            // plano, para ele já estar pronto quando chegar a hora
            // (o arquivo é grande, e isso evita a demora perceptível)
            preloadSceneVideo();

            // --- pergunta (voz feminina) — só a voz, sem escrever na tela ---
            await speakLine(NARRATION.mirrorQuestion);

            await sleep(500);

            // --- resposta (voz masculina) — só a voz, sem escrever na tela ---
            var answerPromise = speakLine(NARRATION.mirrorAnswer);

            await sleep(1500); // aproximadamente onde "essa pessoa é linda..." termina
            beginTransformation();

            await answerPromise;

            await sleep(1000);

            // segura a revelação por um instante antes de seguir para a Cena 3
            await sleep(1800);

        } catch (e) {
            // se qualquer parte da fala falhar, a história continua mesmo assim
            if (!revealImg.classList.contains('show')) beginTransformation();
        }

        startScene3();
    }

    function beginTransformation() {

        goldGlow.classList.add('show');

        // a selfie começa a se dissolver em brilho dourado...
        selfieFreeze.style.transition = 'opacity 2.2s ease, filter 2.2s ease';
        selfieFreeze.style.filter = 'brightness(1.6) saturate(1.3)';
        selfieFreeze.style.opacity = '0';

        // ...e a aniversariante aparece no mesmo lugar
        setTimeout(function () {
            revealImg.classList.add('show');
        }, 500);

        // o brilho relaxa depois que a troca terminou
        setTimeout(function () {
            goldGlow.classList.remove('show');
        }, 2600);
    }

    /* ======================================================
    CENA 3 — ENTRANDO NO ESPELHO (PORTAL)
    ====================================================== */

    function startScene3() {

        frame.classList.add('fadeOut');
        appEl.classList.add('zoomIn');
        revealImg.classList.add('zoomIn');

        setTimeout(function () {
            scene3Glow.classList.add('show');
        }, 900);

        setTimeout(function () {
            startScene4();
        }, 2500);
    }

    /* ======================================================
    CENA 4 — VÍDEO DA FLORESTA
    ====================================================== */

    function startScene4() {

        // esconde tudo da cena anterior
        appEl.style.display = 'none';
        scene2Text.style.display = 'none';
        goldGlow.style.display = 'none';
        revealImg.style.display = 'none';
        scene3Glow.style.display = 'none';

        sceneVideo.style.display = 'block';

        try { sceneVideo.currentTime = 0; } catch (e) {}

        function tryPlayMuted() {
            sceneVideo.muted = true;
            sceneVideo.play().catch(function () {
                // se nem mudo tocar sozinho, mostra um botão para a
                // pessoa tocar e iniciar manualmente
                unmuteHint.textContent = '▶ Toque para continuar';
                unmuteHint.style.display = 'block';
            });
            unmuteHint.textContent = '🔊 Toque para ativar o som';
            unmuteHint.style.display = 'block';
        }

        var playPromise = sceneVideo.play();
        if (playPromise && playPromise.catch) {
            playPromise.catch(tryPlayMuted);
        }

        unmuteHint.addEventListener('click', function () {
            sceneVideo.muted = false;
            sceneVideo.play().catch(function () {});
            unmuteHint.style.display = 'none';
        });

        // narração: primeira parte logo no início, segunda parte
        // perto do final do vídeo
        speakLine(NARRATION.forestPart1);

        var secondPartTriggered = false;
        sceneVideo.addEventListener('timeupdate', function () {
            if (secondPartTriggered) return;
            if (!sceneVideo.duration) return;

            var remaining = sceneVideo.duration - sceneVideo.currentTime;
            if (remaining <= 6) {
                secondPartTriggered = true;
                speakLine(NARRATION.forestPart2);
            }
        });

        sceneVideo.addEventListener('ended', function () {
            startScene5();
        });
    }

    /* ======================================================
    CENA 5 — CONVITE / DADOS DA FESTA
    ====================================================== */

    // posiciona o botão invisível exatamente em cima da caixa
    // "Pix presente" desenhada na imagem, acompanhando o
    // tamanho da tela (mesma lógica do oval do espelho)
    function positionPixButton() {

        var w = window.innerWidth;
        var h = window.innerHeight;

        var scale = Math.max(w / INVITE_IMG.w, h / INVITE_IMG.h);

        function toScreenX(px) {
            return w / 2 + (px - INVITE_IMG.w / 2) * scale;
        }
        function toScreenY(py) {
            return h / 2 + (py - INVITE_IMG.h / 2) * scale;
        }

        var left   = toScreenX(PIX_BOX.left);
        var top    = toScreenY(PIX_BOX.top);
        var right  = toScreenX(PIX_BOX.right);
        var bottom = toScreenY(PIX_BOX.bottom);

        pixButton.style.left   = left + 'px';
        pixButton.style.top    = top + 'px';
        pixButton.style.width  = (right - left) + 'px';
        pixButton.style.height = (bottom - top) + 'px';
    }

    function copyPixKey() {

        function showToast() {
            pixToast.classList.add('show');
            setTimeout(function () {
                pixToast.classList.remove('show');
            }, 2200);
        }

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(PIX_KEY).then(showToast).catch(function () {
                fallbackCopy();
            });
        } else {
            fallbackCopy();
        }

        function fallbackCopy() {
            var temp = document.createElement('textarea');
            temp.value = PIX_KEY;
            temp.style.position = 'fixed';
            temp.style.opacity = '0';
            document.body.appendChild(temp);
            temp.focus();
            temp.select();
            try {
                document.execCommand('copy');
                showToast();
            } catch (e) {
                // último caso: nada a fazer, mas não trava a página
            }
            document.body.removeChild(temp);
        }
    }

    function startScene5() {

        sceneVideo.style.display = 'none';

        positionPixButton();
        pixButton.style.display = 'block';

        inviteImg.classList.add('show');
    }

    pixButton.addEventListener('click', copyPixKey);

    /* ======================================================
    REDIMENSIONAMENTO / ROTAÇÃO DE TELA
    ====================================================== */

    var resizeTimer = null;
    function onWindowResize() {
        if (resizeTimer) return;
        resizeTimer = requestAnimationFrame(function () {
            resizeTimer = null;
            resizeCanvas();
            if (pixButton.style.display === 'block') positionPixButton();
        });
    }

    window.addEventListener('resize', onWindowResize);
    window.addEventListener('orientationchange', onWindowResize);

    /* ======================================================
    INICIALIZAÇÃO
    ====================================================== */

    function init() {
        skipWelcomeScreen();
        updateFrameMask();
        resizeCanvas();
        startCamera();

        // garante que o embaçado é redesenhado quando a imagem
        // terminar de carregar, caso ainda não estivesse pronta
        if (!fogImage.complete) {
            fogImage.addEventListener('load', resizeCanvas);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
