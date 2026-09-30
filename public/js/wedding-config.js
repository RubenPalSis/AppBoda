/**
 * ============================================================
 *  CONFIGURACIÓN DE LA BODA
 * ============================================================
 *  Este es el ÚNICO archivo que hay que editar para cambiar los
 *  datos de la boda (nombres, fecha, lugares, horarios, textos,
 *  colores, límites de subida...).
 *
 *  Los campos vacíos ("") se muestran como "Por confirmar".
 * ============================================================
 */
export const weddingConfig = {
    // Identificador interno (carpeta en Firebase Storage y claves de localStorage).
    // Si reutilizas la app para otra boda, cámbialo (solo letras, números y guiones).
    weddingId: "iv-angela-2026",

    coupleNames: "Iván & Ángela",
    // Iniciales para el monograma de la cabecera.
    monogram: "I & Á",

    // Fecha de la boda (AAAA-MM-DD).
    date: "2026-11-07",
    // Hora a la que termina la cuenta atrás (HH:MM, hora local). "" = medianoche.
    countdownTime: "",

    // Código de acceso para invitados.
    // OJO: es solo una barrera de la interfaz. La seguridad real está en
    // firestore.rules y storage.rules.
    accessCode: "IvAngela2026",

    ceremony: {
        name: "",       // Ej.: nombre de la iglesia / lugar
        address: "",    // Dirección completa
        time: "",       // Ej.: "12:30"
        mapsUrl: ""     // Enlace de Google Maps (si está vacío se genera a partir de la dirección)
    },

    reception: {
        name: "",
        address: "",
        time: "",
        mapsUrl: ""
    },

    // Programa del día. Añade tantas entradas como quieras.
    // Ejemplo: { time: "12:30", title: "Ceremonia", description: "" }
    schedule: [],

    // Información adicional (dress code, alojamiento, transporte...).
    // Ejemplo: { title: "Dress code", text: "..." }
    extraInfo: [],

    texts: {
        gateTagline: "Comparte tus recuerdos con nosotros ❤️",
        welcome: "Bienvenidos a nuestro día",
        countdownBefore: "Falta muy poco para el gran día",
        countdownToday: "¡Hoy es nuestro gran día! 💍",
        countdownAfter: "Gracias por compartir este día con nosotros ❤️",
        uploadIntro: "Comparte las fotos que hagas durante la boda. Aparecerán al instante en la galería.",
        galleryEmpty: "Todavía no hay fotos. ¡Sé el primero en compartir un recuerdo!"
    },

    // Imagen principal de la portada (opcional). Ej.: "assets/images/portada.jpg"
    heroImage: "",

    // Colores (se aplican como variables CSS). Si los cambias, cambia también
    // "theme_color" y "background_color" en manifest.json.
    theme: {
        cream: "#faf7f2",
        ink: "#1f1c18",
        gold: "#b8975a",
        beige: "#e8dccb"
    },

    // Límites de subida.
    upload: {
        maxFilesPerUpload: 20,          // Fotos por operación
        maxOriginalSizeMB: 40,          // Se rechazan originales más grandes
        maxSide: 1800,                  // Lado más largo de la foto final (px)
        quality: 0.78,                  // Calidad JPEG (0-1)
        thumbMaxSide: 480,              // Miniatura para la galería
        thumbQuality: 0.7
    },

    gallery: {
        pageSize: 30                    // Fotos cargadas por bloque (scroll infinito)
    },

    admin: {
        zipBaseName: "fotos-boda-ivan-angela",
        zipMaxPhotosPerFile: 300,       // Si hay más fotos, se generan varios ZIP
        downloadConcurrency: 4
    }
};
