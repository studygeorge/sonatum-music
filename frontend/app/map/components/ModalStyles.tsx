'use client';

export default function ModalStyles() {
  return (
    <style jsx global>{`
      /* ====== АНИМАЦИИ ====== */
      @keyframes modalFadeIn {
        0% {
          opacity: 0;
          backdrop-filter: blur(0px);
        }
        100% {
          opacity: 1;
          backdrop-filter: blur(12px);
        }
      }

      @keyframes modalSlideIn {
        0% {
          opacity: 0;
          transform: scale(0.7) translateY(100px) rotateX(20deg);
        }
        50% {
          transform: scale(1.05) translateY(-10px) rotateX(0deg);
        }
        100% {
          opacity: 1;
          transform: scale(1) translateY(0) rotateX(0deg);
        }
      }

      @keyframes shimmerFlow {
        0% {
          background-position: -200% center;
        }
        100% {
          background-position: 200% center;
        }
      }

      @keyframes pulseGlow {
        0%, 100% {
          box-shadow: 0 0 20px rgba(246, 211, 101, 0.4),
                      0 0 40px rgba(253, 160, 133, 0.3),
                      0 10px 60px rgba(0, 0, 0, 0.3);
        }
        50% {
          box-shadow: 0 0 40px rgba(246, 211, 101, 0.6),
                      0 0 80px rgba(253, 160, 133, 0.5),
                      0 15px 80px rgba(0, 0, 0, 0.4);
        }
      }

      @keyframes floatBadge {
        0%, 100% {
          transform: translateY(0px);
        }
        50% {
          transform: translateY(-8px);
        }
      }

      @keyframes revealText {
        0% {
          opacity: 0;
          transform: translateY(20px);
        }
        100% {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @keyframes cardSlideIn {
        0% {
          opacity: 0;
          transform: translateX(-40px) scale(0.9);
        }
        100% {
          opacity: 1;
          transform: translateX(0) scale(1);
        }
      }

      @keyframes borderSpin {
        0% {
          transform: rotate(0deg);
        }
        100% {
          transform: rotate(360deg);
        }
      }

      @keyframes ripple {
        0% {
          transform: scale(0);
          opacity: 1;
        }
        100% {
          transform: scale(4);
          opacity: 0;
        }
      }

      /* ====== КНОПКА "ПОДРОБНЕЕ" ====== */
      .detail-button {
        position: relative;
        width: 100%;
        padding: 18px 24px;
        margin-bottom: 12px;
        background: linear-gradient(135deg, #f6d365 0%, #fda085 50%, #f6d365 100%);
        background-size: 200% 100%;
        color: #1a202c;
        border: none;
        border-radius: 16px;
        font-size: 17px;
        font-weight: 800;
        cursor: pointer;
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        transition: all 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        box-shadow: 0 8px 25px rgba(246, 211, 101, 0.5),
                    0 0 0 0 rgba(255, 215, 0, 0);
        animation: pulseGlow 3s ease-in-out infinite;
      }

      .detail-button::before {
        content: '';
        position: absolute;
        top: -50%;
        left: -50%;
        width: 200%;
        height: 200%;
        background: linear-gradient(
          45deg,
          transparent 30%,
          rgba(255, 255, 255, 0.6) 50%,
          transparent 70%
        );
        transform: rotate(45deg);
        animation: shimmerFlow 3s linear infinite;
      }

      .detail-button::after {
        content: '';
        position: absolute;
        inset: -3px;
        background: linear-gradient(
          90deg,
          #f6d365,
          #fda085,
          #ff6b9d,
          #c471ed,
          #12c2e9,
          #f6d365
        );
        background-size: 400% 100%;
        border-radius: 16px;
        z-index: -1;
        opacity: 0;
        transition: opacity 0.3s ease;
        animation: shimmerFlow 6s linear infinite;
      }

      .detail-button:hover {
        transform: translateY(-4px) scale(1.02);
        background-position: 100% center;
        box-shadow: 0 15px 40px rgba(246, 211, 101, 0.7),
                    0 0 60px rgba(253, 160, 133, 0.5),
                    0 0 0 8px rgba(255, 215, 0, 0.2);
      }

      .detail-button:hover::after {
        opacity: 1;
      }

      .detail-button:active {
        transform: translateY(-1px) scale(0.98);
      }

      .detail-button-text {
        position: relative;
        z-index: 2;
        text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        letter-spacing: 0.5px;
      }

      .detail-button-icon {
        position: relative;
        z-index: 2;
        font-size: 22px;
        transition: transform 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
      }

      .detail-button:hover .detail-button-icon {
        transform: translateX(6px) scale(1.2);
      }

      /* ====== ОВЕРЛЕЙ МОДАЛЬНОГО ОКНА ====== */
      .modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.85);
        z-index: 20000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        animation: modalFadeIn 0.5s ease-out;
        backdrop-filter: blur(12px);
      }

      /* ====== КОНТЕНТ МОДАЛЬНОГО ОКНА ====== */
      .modal-content {
        position: relative;
        width: 100%;
        max-width: 950px;
        max-height: 90vh;
        background: linear-gradient(145deg, #ffffff 0%, #f8fafc 50%, #ffffff 100%);
        border-radius: 32px;
        overflow: hidden;
        animation: modalSlideIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
        box-shadow: 0 30px 90px rgba(0, 0, 0, 0.5),
                    0 0 0 1px rgba(255, 255, 255, 0.5) inset;
        perspective: 1000px;
      }

      .modal-content::before {
        content: '';
        position: absolute;
        inset: -2px;
        background: linear-gradient(
          45deg,
          #f6d365,
          #fda085,
          #ff6b9d,
          #c471ed,
          #12c2e9,
          #f6d365
        );
        background-size: 400% 100%;
        border-radius: 32px;
        z-index: -1;
        opacity: 0.6;
        animation: shimmerFlow 8s linear infinite;
        filter: blur(2px);
      }

      .modal-scroll-wrapper {
        max-height: 90vh;
        overflow-y: auto;
        overflow-x: hidden;
      }

      /* ====== КНОПКА ЗАКРЫТИЯ ====== */
      .modal-close {
        position: sticky;
        top: 20px;
        right: 20px;
        float: right;
        width: 50px;
        height: 50px;
        background: linear-gradient(135deg, #ff6b6b 0%, #ff8787 100%);
        border: 2px solid rgba(255, 255, 255, 0.8);
        border-radius: 50%;
        font-size: 24px;
        line-height: 1;
        color: white;
        cursor: pointer;
        transition: all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 100;
        box-shadow: 0 4px 15px rgba(255, 107, 107, 0.4);
      }

      .modal-close::before {
        content: '';
        position: absolute;
        inset: -4px;
        background: linear-gradient(45deg, #ff6b6b, #ff8787, #ff6b6b);
        background-size: 200% 100%;
        border-radius: 50%;
        z-index: -1;
        opacity: 0;
        transition: opacity 0.3s ease;
        animation: shimmerFlow 2s linear infinite;
      }

      .modal-close:hover {
        transform: rotate(180deg) scale(1.15);
        box-shadow: 0 8px 25px rgba(255, 107, 107, 0.6);
      }

      .modal-close:hover::before {
        opacity: 1;
      }

      .modal-close:active {
        transform: rotate(180deg) scale(0.95);
      }

      /* ====== ЗАГОЛОВОК МОДАЛЬНОГО ОКНА ====== */
      .modal-header {
        padding: 50px 50px 30px 50px;
        background: linear-gradient(135deg, rgba(246, 211, 101, 0.1) 0%, rgba(253, 160, 133, 0.1) 100%);
        border-bottom: 3px solid transparent;
        border-image: linear-gradient(90deg, #f6d365, #fda085, #ff6b9d) 1;
        display: flex;
        align-items: center;
        gap: 24px;
        position: relative;
        overflow: hidden;
      }

      .modal-header::before {
        content: '';
        position: absolute;
        top: 0;
        left: -100%;
        width: 100%;
        height: 100%;
        background: linear-gradient(
          90deg,
          transparent,
          rgba(255, 255, 255, 0.3),
          transparent
        );
        animation: shimmerFlow 3s linear infinite;
      }

      .modal-badge {
        width: 12px;
        height: 80px;
        border-radius: 6px;
        flex-shrink: 0;
        background: linear-gradient(180deg, #f6d365 0%, #fda085 100%);
        box-shadow: 0 4px 15px rgba(246, 211, 101, 0.5);
        animation: floatBadge 3s ease-in-out infinite;
        position: relative;
      }

      .modal-badge::before {
        content: '';
        position: absolute;
        inset: -2px;
        background: inherit;
        border-radius: inherit;
        filter: blur(8px);
        opacity: 0.6;
        z-index: -1;
      }

      .modal-title {
        font-size: 42px;
        font-weight: 900;
        background: linear-gradient(135deg, #1a202c 0%, #2d3748 50%, #1a202c 100%);
        background-clip: text;
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        margin: 0;
        line-height: 1.2;
        flex: 1;
        animation: revealText 0.8s ease-out 0.2s backwards;
        text-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
      }

      /* ====== ТЕЛО МОДАЛЬНОГО ОКНА ====== */
      .modal-body {
        padding: 45px 50px 50px 50px;
        background: linear-gradient(180deg, transparent 0%, rgba(246, 211, 101, 0.03) 100%);
      }

      .modal-section {
        margin-bottom: 45px;
        animation: cardSlideIn 0.6s ease-out backwards;
      }

      .modal-section:nth-child(1) { animation-delay: 0.1s; }
      .modal-section:nth-child(2) { animation-delay: 0.2s; }
      .modal-section:nth-child(3) { animation-delay: 0.3s; }
      .modal-section:nth-child(4) { animation-delay: 0.4s; }

      .modal-section:last-child {
        margin-bottom: 0;
      }

      .section-title {
        font-size: 28px;
        font-weight: 800;
        background: linear-gradient(135deg, #2d3748 0%, #4a5568 100%);
        background-clip: text;
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        margin: 0 0 20px 0;
        position: relative;
        padding-left: 20px;
      }

      .section-title::before {
        content: '';
        position: absolute;
        left: 0;
        top: 50%;
        transform: translateY(-50%);
        width: 6px;
        height: 70%;
        background: linear-gradient(180deg, #f6d365 0%, #fda085 100%);
        border-radius: 3px;
        box-shadow: 0 0 10px rgba(246, 211, 101, 0.5);
      }

      .section-text {
        font-size: 17px;
        line-height: 1.9;
        color: #4a5568;
        margin: 0;
        text-align: justify;
        letter-spacing: 0.3px;
      }

      /* ====== КАРТОЧКИ КОМПОЗИТОРОВ ====== */
      .composer-detail-card {
        background: linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(248, 250, 252, 0.95) 100%);
        border: 2px solid transparent;
        background-clip: padding-box;
        border-radius: 20px;
        padding: 28px;
        margin-bottom: 24px;
        position: relative;
        transition: all 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        overflow: hidden;
      }

      .composer-detail-card::before {
        content: '';
        position: absolute;
        inset: -2px;
        background: linear-gradient(135deg, #f6d365, #fda085);
        border-radius: 20px;
        z-index: -1;
        opacity: 0;
        transition: opacity 0.4s ease;
      }

      .composer-detail-card::after {
        content: '';
        position: absolute;
        top: -50%;
        left: -50%;
        width: 200%;
        height: 200%;
        background: radial-gradient(circle, rgba(246, 211, 101, 0.1) 0%, transparent 70%);
        opacity: 0;
        transition: opacity 0.4s ease;
      }

      .composer-detail-card:hover {
        transform: translateY(-8px) scale(1.02);
        box-shadow: 0 20px 60px rgba(246, 211, 101, 0.3),
                    0 0 0 1px rgba(246, 211, 101, 0.2);
      }

      .composer-detail-card:hover::before {
        opacity: 1;
      }

      .composer-detail-card:hover::after {
        opacity: 1;
      }

      .composer-detail-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
        position: relative;
        z-index: 1;
      }

      .composer-detail-name {
        font-size: 24px;
        font-weight: 800;
        background: linear-gradient(135deg, #1a202c 0%, #2d3748 100%);
        background-clip: text;
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        margin: 0;
      }

      .composer-detail-years {
        font-size: 15px;
        font-weight: 700;
        color: #718096;
        background: linear-gradient(135deg, rgba(246, 211, 101, 0.2) 0%, rgba(253, 160, 133, 0.2) 100%);
        padding: 6px 14px;
        border-radius: 10px;
        border: 1px solid rgba(246, 211, 101, 0.3);
      }

      .composer-detail-bio {
        font-size: 16px;
        line-height: 1.8;
        color: #4a5568;
        margin: 0 0 20px 0;
        position: relative;
        z-index: 1;
        text-align: justify;
      }

      .composer-works {
        background: linear-gradient(135deg, rgba(246, 211, 101, 0.1) 0%, rgba(253, 160, 133, 0.1) 100%);
        border-radius: 14px;
        padding: 20px;
        border: 1px solid rgba(246, 211, 101, 0.2);
        position: relative;
        z-index: 1;
      }

      .works-title {
        font-size: 16px;
        font-weight: 700;
        color: #2d3748;
        margin: 0 0 14px 0;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .works-title::before {
        content: '🎵';
        font-size: 20px;
      }

      .works-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 10px;
      }

      .work-item {
        font-size: 15px;
        color: #4a5568;
        padding: 10px 12px 10px 36px;
        background: rgba(255, 255, 255, 0.7);
        border-radius: 8px;
        position: relative;
        transition: all 0.3s ease;
        border-left: 3px solid transparent;
      }

      .work-item::before {
        content: '♪';
        position: absolute;
        left: 12px;
        top: 50%;
        transform: translateY(-50%);
        color: #f6d365;
        font-size: 18px;
        font-weight: bold;
        transition: transform 0.3s ease;
      }

      .work-item:hover {
        background: rgba(255, 255, 255, 1);
        border-left-color: #fda085;
        transform: translateX(6px);
      }

      .work-item:hover::before {
        transform: translateY(-50%) scale(1.3) rotate(20deg);
      }

      /* ====== ДОСТОПРИМЕЧАТЕЛЬНОСТИ ====== */
      .landmarks-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 14px;
      }

      .landmark-item {
        font-size: 16px;
        color: #4a5568;
        padding: 16px 20px;
        background: linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(248, 250, 252, 0.9) 100%);
        border-left: 5px solid #f6d365;
        border-radius: 12px;
        transition: all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
        position: relative;
        overflow: hidden;
      }

      .landmark-item::before {
        content: '';
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        width: 5px;
        background: linear-gradient(180deg, #f6d365 0%, #fda085 100%);
        box-shadow: 0 0 15px rgba(246, 211, 101, 0.6);
        opacity: 0;
        transition: opacity 0.3s ease;
      }

      .landmark-item:hover {
        background: rgba(255, 255, 255, 1);
        transform: translateX(10px) scale(1.02);
        box-shadow: 0 8px 25px rgba(246, 211, 101, 0.2);
      }

      .landmark-item:hover::before {
        opacity: 1;
      }

      /* ====== ФЕСТИВАЛИ ====== */
      .festivals-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 20px;
      }

      .festival-card {
        background: linear-gradient(135deg, rgba(246, 211, 101, 0.15) 0%, rgba(253, 160, 133, 0.15) 100%);
        border: 2px solid rgba(246, 211, 101, 0.4);
        border-radius: 16px;
        padding: 24px;
        display: flex;
        align-items: center;
        gap: 16px;
        transition: all 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        position: relative;
        overflow: hidden;
      }

      .festival-card::before {
        content: '';
        position: absolute;
        inset: -2px;
        background: linear-gradient(135deg, #f6d365, #fda085);
        border-radius: 16px;
        z-index: -1;
        opacity: 0;
        transition: opacity 0.4s ease;
      }

      .festival-card:hover {
        transform: translateY(-8px) scale(1.05);
        box-shadow: 0 15px 40px rgba(246, 211, 101, 0.4);
        background: linear-gradient(135deg, rgba(246, 211, 101, 0.25) 0%, rgba(253, 160, 133, 0.25) 100%);
      }

      .festival-card:hover::before {
        opacity: 0.3;
      }

      .festival-icon {
        font-size: 36px;
        flex-shrink: 0;
        transition: transform 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.1));
      }

      .festival-card:hover .festival-icon {
        transform: scale(1.2) rotate(10deg);
      }

      .festival-name {
        font-size: 16px;
        font-weight: 700;
        color: #2d3748;
        line-height: 1.5;
      }

      /* ====== СКРОЛЛБАР ====== */
      .modal-scroll-wrapper::-webkit-scrollbar {
        width: 10px;
      }

      .modal-scroll-wrapper::-webkit-scrollbar-track {
        background: linear-gradient(180deg, rgba(246, 211, 101, 0.1) 0%, rgba(253, 160, 133, 0.1) 100%);
        border-radius: 10px;
      }

      .modal-scroll-wrapper::-webkit-scrollbar-thumb {
        background: linear-gradient(180deg, #f6d365 0%, #fda085 100%);
        border-radius: 10px;
        border: 2px solid transparent;
        background-clip: padding-box;
      }

      .modal-scroll-wrapper::-webkit-scrollbar-thumb:hover {
        background: linear-gradient(180deg, #fda085 0%, #ff6b9d 100%);
        background-clip: padding-box;
      }

      /* ====== АДАПТИВНОСТЬ ====== */
      @media (max-width: 768px) {
        .modal-header {
          padding: 35px 25px 20px 25px;
        }

        .modal-title {
          font-size: 32px;
        }

        .modal-body {
          padding: 35px 25px;
        }

        .section-title {
          font-size: 24px;
        }

        .festivals-grid {
          grid-template-columns: 1fr;
        }

        .composer-detail-card {
          padding: 20px;
        }

        .detail-button {
          padding: 16px 20px;
        }
      }

      @media (max-width: 480px) {
        .modal-title {
          font-size: 26px;
        }

        .modal-header {
          padding: 30px 20px 15px 20px;
        }

        .modal-body {
          padding: 30px 20px;
        }
      }
    `}</style>
  );
}