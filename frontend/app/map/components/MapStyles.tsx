'use client';

export default function MapStyles() {
  return (
    <style jsx global>{`
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }

      html, body {
        width: 100%;
        height: 100%;
        overflow: hidden;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', sans-serif;
      }

      @keyframes slideInRight {
        from {
          opacity: 0;
          transform: translateX(100px);
        }
        to {
          opacity: 1;
          transform: translateX(0);
        }
      }

      .map-fullscreen-container {
        width: 100vw;
        height: 100vh;
        position: relative;
        background: #f5f7fa;
      }

      .map-loading, .map-error {
        width: 100vw;
        height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-direction: column;
        gap: 16px;
        background: #f5f7fa;
        fontSize: 18px;
        color: #2d3748;
      }

      .map-error {
        color: #e53e3e;
      }

      .geography-path {
        cursor: pointer;
        will-change: auto;
      }

      .geography-path:focus {
        outline: none;
      }

      .geography-path:hover {
        cursor: pointer;
      }

      .zoom-controls {
        position: fixed;
        top: 24px;
        right: 24px;
        display: flex;
        gap: 8px;
        z-index: 1000;
      }

      .zoom-button {
        width: 44px;
        height: 44px;
        border-radius: 12px;
        background: rgba(255, 255, 255, 0.9);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(0, 0, 0, 0.06);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        font-size: 20px;
        font-weight: 600;
        color: #2d3748;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        transition: transform 0.15s ease, box-shadow 0.15s ease;
        user-select: none;
      }

      .zoom-button:hover {
        background: rgba(255, 255, 255, 1);
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
      }

      .zoom-button:active {
        transform: translateY(0);
        transition: transform 0.05s ease;
      }

      .reset-button {
        width: auto;
        padding: 0 16px;
        font-size: 14px;
        font-weight: 600;
      }

      .region-card {
        position: fixed !important;
        top: 50%;
        right: 32px;
        transform: translateY(-50%);
        width: 380px;
        max-height: 80vh;
        overflow-y: auto;
        background: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(20px) saturate(180%);
        -webkit-backdrop-filter: blur(20px) saturate(180%);
        border-radius: 24px;
        padding: 28px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
        border: 2px solid rgba(255, 255, 255, 0.8);
        z-index: 10000 !important;
        animation: slideInRight 0.3s ease-out forwards;
        pointer-events: all;
        will-change: transform, opacity;
      }

      .region-card-header {
        display: flex;
        align-items: flex-start;
        gap: 16px;
        margin-bottom: 24px;
        padding-bottom: 20px;
        border-bottom: 1px solid rgba(0, 0, 0, 0.06);
      }

      .region-color-badge {
        width: 12px;
        height: 48px;
        border-radius: 6px;
        flex-shrink: 0;
      }

      .region-name {
        font-size: 22px;
        font-weight: 600;
        color: #1a202c;
        line-height: 1.4;
        flex: 1;
      }

      .region-stats {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
        margin-bottom: 24px;
      }

      .stat-item {
        padding: 16px;
        background: rgba(255, 255, 255, 0.6);
        backdrop-filter: blur(10px);
        border-radius: 12px;
        border: 1px solid rgba(0, 0, 0, 0.04);
      }

      .stat-label {
        font-size: 13px;
        font-weight: 500;
        color: #718096;
        margin-bottom: 6px;
      }

      .stat-value {
        font-size: 24px;
        font-weight: 700;
        color: #2d3748;
      }

      .composers-list {
        margin-bottom: 20px;
      }

      .composers-title {
        font-size: 14px;
        font-weight: 600;
        color: #4a5568;
        margin-bottom: 12px;
      }

      .composer-item {
        padding: 12px 14px;
        background: rgba(255, 255, 255, 0.6);
        backdrop-filter: blur(10px);
        border-radius: 10px;
        margin-bottom: 8px;
        font-size: 14px;
        color: #2d3748;
        font-weight: 500;
        border: 1px solid rgba(0, 0, 0, 0.04);
      }

      .close-button {
        width: 100%;
        padding: 14px;
        background: rgba(255, 255, 255, 0.8);
        backdrop-filter: blur(10px);
        color: #2d3748;
        border: 1px solid rgba(0, 0, 0, 0.1);
        border-radius: 12px;
        font-size: 15px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .close-button:hover {
        background: rgba(255, 255, 255, 1);
        transform: translateY(-1px);
      }

      .close-button:active {
        transform: translateY(0);
      }

      .hover-label {
        position: fixed !important;
        top: 24px;
        left: 24px;
        padding: 12px 18px;
        background: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(10px);
        border-radius: 12px;
        font-size: 15px;
        font-weight: 600;
        color: #2d3748;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        border: 1px solid rgba(0, 0, 0, 0.1);
        z-index: 9999;
        pointer-events: none;
      }

      .region-card::-webkit-scrollbar {
        width: 6px;
      }

      .region-card::-webkit-scrollbar-track {
        background: rgba(0, 0, 0, 0.05);
        border-radius: 10px;
      }

      .region-card::-webkit-scrollbar-thumb {
        background: rgba(0, 0, 0, 0.2);
        border-radius: 10px;
      }

      .region-card::-webkit-scrollbar-thumb:hover {
        background: rgba(0, 0, 0, 0.3);
      }

      /* ====== КНОПКА "ПОДРОБНЕЕ" С АНИМАЦИЕЙ ====== */
      @keyframes shimmer {
        0% {
          background-position: -200% center;
        }
        100% {
          background-position: 200% center;
        }
      }

      @keyframes borderGlow {
        0%, 100% {
          box-shadow: 0 0 5px rgba(255, 215, 0, 0.5),
                      0 0 10px rgba(255, 215, 0, 0.3),
                      inset 0 0 5px rgba(255, 215, 0, 0.2);
        }
        50% {
          box-shadow: 0 0 10px rgba(255, 215, 0, 0.8),
                      0 0 20px rgba(255, 215, 0, 0.5),
                      inset 0 0 10px rgba(255, 215, 0, 0.4);
        }
      }

      .detail-button {
        position: relative;
        width: 100%;
        padding: 16px;
        margin-bottom: 12px;
        background: linear-gradient(135deg, #f6d365 0%, #fda085 100%);
        color: #1a202c;
        border: 2px solid transparent;
        border-radius: 14px;
        font-size: 16px;
        font-weight: 700;
        cursor: pointer;
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        transition: all 0.3s ease;
        animation: borderGlow 2s ease-in-out infinite;
      }

      .detail-button::before {
        content: '';
        position: absolute;
        top: -2px;
        left: -2px;
        right: -2px;
        bottom: -2px;
        background: linear-gradient(
          90deg,
          transparent,
          rgba(255, 215, 0, 0.8),
          transparent
        );
        background-size: 200% 100%;
        border-radius: 14px;
        animation: shimmer 3s linear infinite;
        z-index: -1;
      }

      .detail-button::after {
        content: '';
        position: absolute;
        inset: 0;
        background: linear-gradient(135deg, #f6d365 0%, #fda085 100%);
        border-radius: 12px;
        z-index: -1;
      }

      .detail-button:hover {
        transform: translateY(-2px);
        box-shadow: 0 0 15px rgba(255, 215, 0, 0.9),
                    0 0 30px rgba(255, 215, 0, 0.6),
                    inset 0 0 15px rgba(255, 215, 0, 0.5);
      }

      .detail-button:active {
        transform: translateY(0);
      }

      .detail-button-text {
        position: relative;
        z-index: 1;
      }

      .detail-button-icon {
        position: relative;
        z-index: 1;
        font-size: 20px;
        transition: transform 0.3s ease;
      }

      .detail-button:hover .detail-button-icon {
        transform: translateX(4px);
      }

      /* ====== МОДАЛЬНОЕ ОКНО ====== */
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      @keyframes slideUp {
        from {
          opacity: 0;
          transform: translateY(50px) scale(0.95);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }

      .modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.75);
        backdrop-filter: blur(8px);
        z-index: 20000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        animation: fadeIn 0.3s ease-out;
      }

      .modal-content {
        position: relative;
        width: 100%;
        max-width: 900px;
        max-height: 90vh;
        background: linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(250, 250, 252, 0.98) 100%);
        backdrop-filter: blur(20px);
        border-radius: 28px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        overflow-y: auto;
        animation: slideUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
      }

      .modal-compact {
        max-width: 500px;
        padding: 40px;
        text-align: center;
      }

      .modal-close {
        position: sticky;
        top: 20px;
        right: 20px;
        float: right;
        width: 44px;
        height: 44px;
        background: rgba(255, 255, 255, 0.9);
        border: 1px solid rgba(0, 0, 0, 0.1);
        border-radius: 50%;
        font-size: 28px;
        line-height: 1;
        color: #2d3748;
        cursor: pointer;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10;
      }

      .modal-close:hover {
        background: rgba(255, 255, 255, 1);
        transform: rotate(90deg) scale(1.1);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      }

      .modal-header {
        padding: 40px 40px 20px 40px;
        border-bottom: 2px solid rgba(0, 0, 0, 0.06);
        display: flex;
        align-items: center;
        gap: 20px;
      }

      .modal-badge {
        width: 8px;
        height: 60px;
        border-radius: 4px;
        flex-shrink: 0;
      }

      .modal-title {
        font-size: 36px;
        font-weight: 700;
        color: #1a202c;
        margin: 0;
        line-height: 1.2;
      }

      .modal-body {
        padding: 40px;
      }

      .modal-section {
        margin-bottom: 40px;
      }

      .modal-section:last-child {
        margin-bottom: 0;
      }

      .section-title {
        font-size: 24px;
        font-weight: 700;
        color: #2d3748;
        margin: 0 0 16px 0;
      }

      .section-text {
        font-size: 16px;
        line-height: 1.8;
        color: #4a5568;
        margin: 0;
      }

      .composer-detail-card {
        background: linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(248, 250, 252, 0.9) 100%);
        border: 1px solid rgba(0, 0, 0, 0.08);
        border-radius: 16px;
        padding: 24px;
        margin-bottom: 20px;
        transition: all 0.3s ease;
      }

      .composer-detail-card:hover {
        transform: translateY(-4px);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
      }

      .composer-detail-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
      }

      .composer-detail-name {
        font-size: 20px;
        font-weight: 700;
        color: #1a202c;
        margin: 0;
      }

      .composer-detail-years {
        font-size: 14px;
        font-weight: 600;
        color: #718096;
        background: rgba(0, 0, 0, 0.05);
        padding: 4px 12px;
        border-radius: 8px;
      }

      .composer-detail-bio {
        font-size: 15px;
        line-height: 1.7;
        color: #4a5568;
        margin: 0 0 16px 0;
      }

      .composer-works {
        background: rgba(255, 255, 255, 0.6);
        border-radius: 12px;
        padding: 16px;
      }

      .works-title {
        font-size: 14px;
        font-weight: 600;
        color: #2d3748;
        margin: 0 0 12px 0;
      }

      .works-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 8px;
      }

      .work-item {
        font-size: 14px;
        color: #4a5568;
        padding-left: 20px;
        position: relative;
      }

      .work-item::before {
        content: '♪';
        position: absolute;
        left: 0;
        color: #f6d365;
        font-size: 16px;
      }

      .landmarks-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 12px;
      }

      .landmark-item {
        font-size: 15px;
        color: #4a5568;
        padding: 12px 16px;
        background: rgba(255, 255, 255, 0.7);
        border-left: 4px solid #f6d365;
        border-radius: 8px;
        transition: all 0.2s ease;
      }

      .landmark-item:hover {
        background: rgba(255, 255, 255, 1);
        transform: translateX(4px);
      }

      .festivals-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 16px;
      }

      .festival-card {
        background: linear-gradient(135deg, rgba(246, 211, 101, 0.2) 0%, rgba(253, 160, 133, 0.2) 100%);
        border: 1px solid rgba(246, 211, 101, 0.3);
        border-radius: 12px;
        padding: 20px;
        display: flex;
        align-items: center;
        gap: 12px;
        transition: all 0.3s ease;
      }

      .festival-card:hover {
        transform: translateY(-4px);
        box-shadow: 0 8px 20px rgba(246, 211, 101, 0.3);
      }

      .festival-icon {
        font-size: 28px;
        flex-shrink: 0;
      }

      .festival-name {
        font-size: 15px;
        font-weight: 600;
        color: #2d3748;
        line-height: 1.4;
      }

      .modal-content::-webkit-scrollbar {
        width: 8px;
      }

      .modal-content::-webkit-scrollbar-track {
        background: rgba(0, 0, 0, 0.05);
        border-radius: 10px;
      }

      .modal-content::-webkit-scrollbar-thumb {
        background: rgba(0, 0, 0, 0.2);
        border-radius: 10px;
      }

      .modal-content::-webkit-scrollbar-thumb:hover {
        background: rgba(0, 0, 0, 0.3);
      }

      @media (max-width: 768px) {
        .modal-header {
          padding: 30px 20px 15px 20px;
        }

        .modal-title {
          font-size: 28px;
        }

        .modal-body {
          padding: 30px 20px;
        }

        .festivals-grid {
          grid-template-columns: 1fr;
        }

        .region-card {
          width: calc(100vw - 32px);
          right: 16px;
          max-height: 70vh;
        }

        .zoom-controls {
          top: 16px;
          right: 16px;
        }
      }
    `}</style>
  );
}