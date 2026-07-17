import i18next from "i18next";
import Backend from "i18next-http-backend";
import LanguageDetector from "i18next-browser-languagedetector";

const initI18n = () =>
  i18next
    .use(Backend)
    .use(LanguageDetector)
    .init({
      fallbackLng: "en",
      debug: true,
      interpolation: {
        escapeValue: false,
      },
      backend: {
        loadPath: "/static/langs/{{lng}}.json",
      },
    });

export default initI18n;
