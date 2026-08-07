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

    /* ======================================================
    CONFIGURAÇÃO

    "primeira.jpg" (moldura) é uma imagem opaca — já vem com o
    vidro do espelho desenhado dentro dela. Para que a câmera e
    o embaçado (canvas) apareçam por baixo, recortamos aqui um
    oval transparente exatamente onde fica o vidro na imagem.

    As medidas abaixo (em pixels da imagem original 864x1536)
    foram tiradas manualmente sobre a arte da moldura.
    Ajuste FRAME_IMG se um dia a imagem da moldura for trocada.
    ====================================================== */

    var FRAME_IMG = {
        w:  864,
        h:  1536,
        cx: 432,   // centro do oval do vidro (x)
        cy: 768,   // centro do oval do vidro (y)
        rx: 285,   // raio horizontal do vidro
        ry: 445    // raio vertical do vidro
    };

    var ERASE_RADIUS = 46; // "grossura do dedo" em px de tela

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

    /* ======================================================
    MÁSCARA OVAL DA MOLDURA

    Recorta a moldura (#frame) para deixar transparente apenas
    a área do vidro, usando a mesma lógica do object-fit:cover
    já aplicado a ela via CSS — assim o recorte acompanha
    qualquer tamanho de tela.
    ====================================================== */

    function updateFrameMask() {

        var w = window.innerWidth;
        var h = window.innerHeight;

        // mesmo fator de escala que o object-fit:cover usa
        var scale = Math.max(w / FRAME_IMG.w, h / FRAME_IMG.h);

        var rxPx = FRAME_IMG.rx * scale;
        var ryPx = FRAME_IMG.ry * scale;

        var rxPct = (rxPx / w) * 100;
        var ryPct = (ryPx / h) * 100;

        var clip = 'ellipse(' + rxPct + '% ' + ryPct + '% at 50% 50%)';

        frame.style.clipPath = clip;
        frame.style.webkitClipPath = clip;

        oval.cx = w / 2;
        oval.cy = h / 2;
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

        var iw = fogImage.naturalWidth;
        var ih = fogImage.naturalHeight;

        // cobre a tela toda (mesmo comportamento do object-fit:cover)
        var scale = Math.max(w / iw, h / ih);
        var dw = iw * scale;
        var dh = ih * scale;
        var dx = (w - dw) / 2;
        var dy = (h - dh) / 2;

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
    ====================================================== */

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

        var shot = document.createElement('canvas');
        shot.width  = Math.round(w * shotDpr);
        shot.height = Math.round(h * shotDpr);

        var sctx = shot.getContext('2d');
        sctx.setTransform(shotDpr, 0, 0, shotDpr, 0, 0);

        // 1) câmera espelhada, cobrindo a tela (igual ao vídeo ao vivo)
        if (video.videoWidth) {
            drawCover(sctx, video, video.videoWidth, video.videoHeight, w, h, true);
        }

        // 2) embaçado com os "buracos" feitos pelo dedo, por cima da câmera
        sctx.drawImage(fogCanvas, 0, 0, w, h);

        // 3) moldura por cima de tudo, com um buraco oval recortado
        //    exatamente onde fica o vidro (para não tampar a câmera)
        sctx.save();
        sctx.beginPath();
        sctx.rect(0, 0, w, h);
        sctx.ellipse(oval.cx, oval.cy, oval.rx, oval.ry, 0, 0, Math.PI * 2, true);
        sctx.clip('evenodd');
        drawCover(sctx, frame, FRAME_IMG.w, FRAME_IMG.h, w, h, false);
        sctx.restore();

        // efeito de flash
        flash.style.transition = 'none';
        flash.style.opacity = '1';
        requestAnimationFrame(function () {
            flash.style.transition = 'opacity .4s';
            flash.style.opacity = '0';
        });

        var dataUrl = shot.toDataURL('image/png');
        photoResult.src = dataUrl;
        preview.style.display = 'flex';
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
    REDIMENSIONAMENTO / ROTAÇÃO DE TELA
    ====================================================== */

    var resizeTimer = null;
    function onWindowResize() {
        if (resizeTimer) return;
        resizeTimer = requestAnimationFrame(function () {
            resizeTimer = null;
            resizeCanvas();
        });
    }

    window.addEventListener('resize', onWindowResize);
    window.addEventListener('orientationchange', onWindowResize);

    /* ======================================================
    INICIALIZAÇÃO
    ====================================================== */

    function init() {
        updateFrameMask();
        resizeCanvas();

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
