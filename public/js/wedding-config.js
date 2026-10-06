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
    countdownTime: "13:00",

    // Código de acceso para invitados.
    // OJO: es solo una barrera de la interfaz. La seguridad real está en
    // firestore.rules.
    accessCode: "IvAngela2026",

    ceremony: {
        name: "Finca Sansui · Salón Hortal",   // Nombre del lugar
        address: "Calle de Alberto Einstein, Villanueva de Gállego (Aragón)",
        time: "13:00 · Ceremonia civil",
        mapsUrl: "https://maps.app.goo.gl/LhUAsVidGZPLcRzY6" // Si está vacío se genera a partir de la dirección
    },

    reception: {
        name: "Finca Sansui · Salón Hortal",
        address: "Calle de Alberto Einstein, Villanueva de Gállego (Aragón)",
        time: "14:15 · Cóctel · 16:00 · Comida",
        mapsUrl: "https://maps.app.goo.gl/LhUAsVidGZPLcRzY6"
    },

    // Programa del día. Añade tantas entradas como quieras.
    schedule: [
        { time: "12:30", title: "Salida de los autobuses", description: "Desde el Museo Pablo Gargallo" },
        { time: "13:00", title: "Ceremonia civil", description: "" },
        { time: "14:15", title: "Cóctel", description: "" },
        { time: "16:00", title: "Comida", description: "" },
        { time: "19:00", title: "Fiestón", description: "" },
        { time: "23:00", title: "Fin de fiesta", description: "" }
    ],

    // Información adicional (dress code, alojamiento, transporte...).
    extraInfo: [
        {
            title: "🚌 Autobuses",
            text: "Autocares Murillo, con salida desde el Museo Pablo Gargallo a las 12:30. Rogamos estar allí 15 minutos antes de la salida."
        },
        {
            title: "🚗 Aparcamiento",
            text: "La propia finca tiene aparcamiento."
        },
        {
            title: "👔 Código de vestimenta",
            text: "No hay código de vestimenta."
        }
    ],

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

    // Límites de subida. Plan Spark (gratuito): las fotos se guardan en Firestore,
    // que tiene 1 GiB gratis y documentos de 1 MiB como máximo. Con ~300 KB por foto
    // caben unas 2.500-3.000. Si subes estos valores, caben menos fotos.
    upload: {
        maxFilesPerUpload: 20,          // Fotos por operación
        maxOriginalSizeMB: 40,          // Se rechazan originales más grandes
        maxSide: 1600,                  // Lado más largo de la foto final (px)
        quality: 0.75,                  // Calidad JPEG inicial (0-1)
        maxBytes: 450 * 1024,           // Tope por foto: si pesa más, se baja calidad/tamaño
        thumbMaxSide: 640,              // Miniatura para el feed y el tablón
        thumbQuality: 0.65,
        thumbMaxBytes: 75 * 1024        // Las reglas de Firestore rechazan miniaturas de 80 KB o más
    },

    gallery: {
        pageSize: 24                    // Fotos cargadas por bloque (scroll infinito)
    },

    admin: {
        zipBaseName: "fotos-boda-ivan-angela",
        zipMaxPhotosPerFile: 300,       // Si hay más fotos, se generan varios ZIP
        downloadConcurrency: 4
    }
};
