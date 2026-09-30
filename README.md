# 💍 Iván & Ángela — App de fotos de la boda (PWA)

Aplicación web instalable (PWA) para que los invitados de la boda de **Iván y Ángela (7 de noviembre de 2026)** suban, vean, descarguen y den ❤️ a las fotos del día.

- **Tecnología:** HTML + CSS + JavaScript vanilla (módulos ES) + Firebase (Hosting, Firestore, Storage, Authentication).
- **Sin frameworks, sin Node.js en producción, sin build.** Node.js solo hace falta para usar la herramienta `firebase` (CLI) al desplegar.
- **Sin analítica, sin trackers, sin publicidad.** No se pide ni se guarda ningún dato personal de los invitados.

---

## Índice

0. [Qué hace la app y cómo está hecha](#0-qué-hace-la-app-y-cómo-está-hecha)
1. [Estructura de archivos](#1-estructura-de-archivos)
2. [Qué tienes que configurar a mano (resumen)](#2-qué-tienes-que-configurar-a-mano-resumen)
- [A. Requisitos previos](#a-requisitos-previos)
- [B. Crear el proyecto de Firebase](#b-crear-el-proyecto-de-firebase)
- [C. Crear la aplicación web en Firebase](#c-crear-la-aplicación-web-en-firebase)
- [D. Firestore Database](#d-firestore-database)
- [E. Firebase Storage](#e-firebase-storage)
- [F. Firebase Authentication](#f-firebase-authentication)
- [G. Configuración del administrador](#g-configuración-del-administrador)
- [H. Código de acceso](#h-configuración-del-código-de-acceso)
- [I. Configuración de la boda](#i-configuración-de-la-boda)
- [J. Probar en local](#j-probar-la-aplicación-en-local)
- [K. Firebase CLI](#k-firebase-cli)
- [L. Despliegue](#l-despliegue)
- [M. URL final](#m-url-final)
- [N. Códigos QR](#n-crear-los-códigos-qr)
- [O. Prueba desde móvil](#o-comprobación-desde-móvil)
- [P. PWA](#p-pwa)
- [Q. Monitorización y costes](#q-monitorización-de-firebase-y-costes)
- [R. Backup](#r-backup-copia-de-seguridad)
- [S. Troubleshooting](#troubleshooting)
- [T. Arquitectura final](#t-arquitectura-final)
- [U. Checklist final](#u-checklist-final)

---

## 0. Qué hace la app y cómo está hecha

### Funcionalidades

| Invitados (`/`) | Administrador (`/admin.html`) |
|---|---|
| Acceso con código de la boda (se recuerda en el dispositivo) | Login con email y contraseña (Firebase Auth) |
| Portada con cuenta atrás | Nº total de fotos, likes, fotos de las últimas 24 h y espacio usado |
| Subida de 1 o varias fotos (hasta 20 por vez) | Ver todas las fotos (filtrar recientes, ordenar por fecha o likes) |
| Compresión automática en el móvil (máx. 1800 px, JPEG 78 %) | Descargar una foto |
| Galería en tiempo real (masonry, carga progresiva, lazy loading) | Seleccionar varias y descargarlas en ZIP |
| Visor a pantalla completa con deslizar ← → | 📦 DESCARGAR TODAS → `fotos-boda-ivan-angela.zip` |
| ❤️ Me gusta (uno por dispositivo, se puede quitar) | Eliminar cualquier foto (o varias a la vez) |
| ⬇️ Descargar foto | |
| 🗑️ Eliminar mis propias fotos | |
| Información de la boda (lugares, horarios, 📍 Cómo llegar) | |
| Instalable como app (Android e iPhone) | |

### La decisión de seguridad más importante: invitados con **Firebase Auth anónimo**

El enunciado pide que los invitados no se registren y que se genere un identificador aleatorio del dispositivo. Si ese identificador fuese solo un texto en `localStorage`, **cualquiera podría copiarlo o inventarlo** desde la consola del navegador y borrar fotos ajenas o sumar likes infinitos: las reglas de Firebase no tendrían forma de comprobar nada.

Por eso la app usa el **inicio de sesión anónimo de Firebase Authentication**:

- Al entrar con el código, el dispositivo obtiene automáticamente un **UID aleatorio** (p. ej. `Xk29sd...`). No pide nombre, email ni teléfono. Para el invitado es invisible.
- Ese UID viaja firmado en cada petición (`request.auth.uid`) y **no se puede falsificar**.
- Las reglas de seguridad comparan `ownerId` de cada foto con `request.auth.uid` → solo el dueño puede borrarla.
- El identificador legible `guest_<UID>` se guarda también en `localStorage`, tal y como pedía el enunciado.

El **código de acceso** (`IvAngela2026`) es solo una puerta de la interfaz: está en el JavaScript público y cualquiera con conocimientos técnicos podría leerlo. **La seguridad real la ponen las reglas de Firestore y Storage.**

### Cómo se almacenan las fotos

Por cada foto se suben **dos archivos ya comprimidos** en el móvil (nunca el original):

| Archivo | Tamaño típico | Uso |
|---|---|---|
| `weddings/iv-angela-2026/photos/photo_<fecha>_<aleatorio>.jpg` | 1800 px, 0,3–1,5 MB | Visor, descargas, ZIP |
| `weddings/iv-angela-2026/thumbs/photo_<fecha>_<aleatorio>.jpg` | 480 px, 30–80 KB | Cuadrícula de la galería |

La miniatura hace que la galería cargue rápido y que se gaste muy poco tráfico (lo que más puede costar). Al redibujar la foto en el dispositivo, **se eliminan los metadatos EXIF (incluida la ubicación GPS)** y se corrige la orientación.

Y un documento en Firestore `photos/{photoId}`:

```javascript
{
  storagePath: "weddings/iv-angela-2026/photos/photo_1762512345678_abc123.jpg",
  thumbPath:   "weddings/iv-angela-2026/thumbs/photo_1762512345678_abc123.jpg",
  downloadURL: "https://firebasestorage.googleapis.com/...",
  thumbURL:    "https://firebasestorage.googleapis.com/...",
  ownerId:     "<UID anónimo del dispositivo>",
  createdAt:   Timestamp (hora del servidor),
  likes:       0,
  width: 1800, height: 1350, size: 812345
}
```

Likes: `photos/{photoId}/likes/{uid}` → el ID del documento es el UID, así que **es imposible que un dispositivo dé dos likes** a la misma foto.

### Librerías externas (todas gratuitas)

| Librería | Dónde | Por qué |
|---|---|---|
| Firebase JS SDK 10.12.2 (CDN oficial `gstatic.com`) | Toda la app | Obligatorio para usar Firebase sin instalar nada |
| JSZip 3.10.1 (CDN jsDelivr) | Solo en `/admin.html`, al pulsar descargar ZIP | El navegador no tiene API nativa para crear ZIP |
| Google Fonts (Cormorant Garamond + Montserrat) | CSS | Tipografías elegantes. Si prefieres no usar Google Fonts, borra las líneas `<link ... fonts.googleapis.com>` de `index.html` y `admin.html`: la app usará Georgia/fuentes del sistema |

---

## 1. Estructura de archivos

```text
AppBoda/
├── firebase.json            ← Configuración de Hosting, reglas y emuladores
├── .firebaserc              ← ID del proyecto de Firebase (lo rellena la CLI)
├── firestore.rules          ← Reglas de seguridad de Firestore
├── firestore.indexes.json   ← Índices (vacío: no hace falta ninguno)
├── storage.rules            ← Reglas de seguridad de Storage
├── cors.json                ← CORS del bucket (necesario para descargas/ZIP)
├── README.md
└── public/                  ← Lo que se publica en Firebase Hosting
    ├── index.html           ← App de invitados
    ├── admin.html           ← Panel de administración (sin enlace visible)
    ├── manifest.json        ← Manifiesto PWA
    ├── service-worker.js    ← Caché offline de la interfaz
    ├── css/
    │   ├── styles.css       ← Estilos de la app (y base del admin)
    │   └── admin.css        ← Estilos del panel
    ├── js/
    │   ├── wedding-config.js  ← ⭐ DATOS DE LA BODA (editar aquí)
    │   ├── firebase-config.js ← ⭐ CREDENCIALES DE FIREBASE (editar aquí)
    │   ├── auth.js          ← Código de acceso + sesión anónima
    │   ├── app.js           ← Arranque, navegación, cuenta atrás, info, PWA
    │   ├── photos.js        ← Capa de datos: subir/leer/borrar fotos
    │   ├── upload.js        ← Selección, compresión y subida
    │   ├── gallery.js       ← Galería y visor
    │   ├── likes.js         ← Me gusta
    │   ├── admin.js         ← Panel de administración + ZIP
    │   └── utils.js         ← Utilidades compartidas (toasts, diálogos, descargas…)
    └── assets/
        ├── icons/           ← Iconos PWA (192, 512, maskable, apple-touch, favicon, svg)
        └── images/          ← Pon aquí la imagen de portada si quieres una
```

---

## 2. Qué tienes que configurar a mano (resumen)

1. Crear el proyecto de Firebase y activar el **plan Blaze** (necesario para Storage; se puede mantener en 0 €, ver [E](#e-firebase-storage)).
2. Copiar las credenciales web en **`public/js/firebase-config.js`**.
3. Activar **Firestore**, **Storage** y **Authentication** (proveedores **Anónimo** y **Correo/contraseña**).
4. Crear el usuario administrador y su documento en la colección **`admins`**.
5. Poner el ID del proyecto en **`.firebaserc`** (o con `firebase use --add`).
6. Desplegar: `firebase deploy`.
7. Configurar **CORS** del bucket (para que funcionen las descargas y el ZIP).
8. Cuando los tengas: lugares y horarios en **`public/js/wedding-config.js`**.

---

## A. Requisitos previos

Necesitas un ordenador (Windows, macOS o Linux) y una cuenta de Google.

### Node.js y npm

Solo se usan para instalar y ejecutar la herramienta de Firebase. Descarga la versión **LTS** desde <https://nodejs.org> e instálala (npm viene incluido).

### Firebase CLI

Abre una terminal (Windows: *PowerShell*; macOS: *Terminal*) y ejecuta:

```bash
npm install -g firebase-tools
```

> En macOS/Linux, si da error de permisos: `sudo npm install -g firebase-tools`.
> En Windows, si PowerShell dice que la ejecución de scripts está deshabilitada: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` y vuelve a intentarlo.

### Git (opcional)

Solo si quieres versionar el proyecto: <https://git-scm.com>.

### Comprobar que todo está instalado

```bash
node --version      # p. ej. v20.x o superior
npm --version       # p. ej. 10.x
firebase --version  # p. ej. 13.x o superior
```

Si alguno responde "command not found" / "no se reconoce", cierra y vuelve a abrir la terminal; si sigue, reinstálalo.

---

## B. Crear el proyecto de Firebase

1. Entra en **<https://console.firebase.google.com>** con tu cuenta de Google.
2. Pulsa **"Crear un proyecto"** (en inglés *"Create a project"*; en la consola nueva puede aparecer como *"Comenzar con un proyecto de Firebase"* / *"Get started with a Firebase project"*).
3. **Nombre:** escribe `ivan-angela-2026`.
   - Debajo verás el **ID del proyecto** (projectId). Si el nombre ya está cogido, Firebase añade un sufijo (p. ej. `ivan-angela-2026-a1b2c`). **Apunta el ID real**: lo necesitarás varias veces. En este documento lo llamaremos `PROJECT_ID`.
4. Acepta las condiciones y pulsa **Continuar**.
5. Si te ofrece **Gemini en Firebase / asistencia de IA**: puedes desactivarlo, la app no lo usa.
6. **Google Analytics:** **desactívalo** (la app no usa analítica y así no se recopila nada de los invitados).
7. Pulsa **"Crear proyecto"**, espera unos segundos y pulsa **Continuar**.

### Activar el plan Blaze (obligatorio para Storage)

Desde octubre de 2024, Firebase exige el plan **Blaze (pago por uso)** para crear el bucket de Storage. **Blaze incluye la misma cuota gratuita que el plan Spark**; para una boda normalmente el coste es **0 €** o céntimos.

1. En la parte inferior del menú izquierdo, junto a *"Spark"*, pulsa **"Actualizar"** (*Upgrade*). También está en ⚙️ → *Uso y facturación* → *Detalles y configuración*.
2. Elige **Blaze**, selecciona o crea una **cuenta de facturación** (pedirá una tarjeta).
3. Cuando te ofrezca crear un **presupuesto**, pon por ejemplo **5 €**: te avisará por email si se acerca a esa cifra. (Es un aviso, no un límite duro. Ver [Q](#q-monitorización-de-firebase-y-costes)).

---

## C. Crear la aplicación web en Firebase

1. En la página principal del proyecto (*Descripción general del proyecto* / *Project Overview*), pulsa el icono **`</>`** (Web). Si no lo ves: ⚙️ (arriba a la izquierda) → **Configuración del proyecto** → pestaña **General** → sección **"Tus apps"** → **"Agregar app"** → **Web**.
2. **Sobrenombre de la app:** `Boda Iván & Ángela`.
3. **NO** marques *"Configurar también Firebase Hosting para esta app"* (lo configuraremos con la CLI; si lo marcas no pasa nada).
4. Pulsa **"Registrar app"**.
5. Firebase mostrará un bloque de código. Elige la opción **"Usar una etiqueta `<script>`"** o **npm**, da igual: solo necesitas el objeto `firebaseConfig`, que se ve así:

   ```javascript
   const firebaseConfig = {
     apiKey: "AIza...",
     authDomain: "PROJECT_ID.firebaseapp.com",
     projectId: "PROJECT_ID",
     storageBucket: "PROJECT_ID.firebasestorage.app",
     messagingSenderId: "1234567890",
     appId: "1:1234567890:web:abcdef..."
   };
   ```

6. Abre **`public/js/firebase-config.js`** y sustituye **solo los valores** entre comillas:

   ```javascript
   const firebaseConfig = {
       apiKey: "TU_API_KEY",                        // ← apiKey
       authDomain: "TU_AUTH_DOMAIN",                // ← authDomain
       projectId: "TU_PROJECT_ID",                  // ← projectId
       storageBucket: "TU_STORAGE_BUCKET",          // ← storageBucket
       messagingSenderId: "TU_MESSAGING_SENDER_ID", // ← messagingSenderId
       appId: "TU_APP_ID"                           // ← appId
   };
   ```

   Si Firebase te da también `measurementId`, **no lo copies** (es de Analytics).

7. Pulsa **"Ir a la consola"**.

> Si más adelante necesitas volver a ver estos datos: ⚙️ → **Configuración del proyecto** → **General** → *Tus apps* → tu app web → *Configuración y SDK del SDK* → **Config**.

> Estas claves **no son secretas**: toda app web de Firebase las expone. Lo que protege los datos son las reglas.

---

## D. Firestore Database

### Crear la base de datos

1. Menú izquierdo → **Compilación** (*Build*) → **Firestore Database**. (En la consola nueva puede estar en **Bases de datos y almacenamiento** / *Databases & Storage*).
2. Pulsa **"Crear base de datos"**.
3. Si pregunta la **edición**, elige **Standard** (*Edición Estándar*).
4. **ID de la base de datos:** déjalo como **`(default)`** (la app y las reglas de Storage dependen de ello).
5. **Ubicación:** elige una región y **no se puede cambiar después**. Recomendado:
   - `eur3 (Europe)` si los invitados están en España/Europa (multi-región, más resistente), o
   - `europe-southwest1 (Madrid)`.
   - La cuota gratuita de Firestore es la misma en cualquier región.
6. **Reglas de seguridad:** selecciona **"Iniciar en modo de producción"** (*production mode*: todo denegado por defecto). **Nunca** "modo de prueba".
7. Pulsa **Crear**.

### Desplegar las reglas del proyecto

No copies reglas a mano: se despliegan desde el archivo `firestore.rules` con:

```bash
firebase deploy --only firestore
```

(ver [K](#k-firebase-cli) para conectar la CLI primero). Si lo prefieres, también puedes pegar el contenido de `firestore.rules` en **Firestore Database → Reglas → Publicar**.

### Reglas completas (`firestore.rules`)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function signedIn() { return request.auth != null; }

    function isAdmin() {
      return signedIn()
        && request.auth.token.firebase.sign_in_provider != 'anonymous'
        && exists(/databases/$(database)/documents/admins/$(request.auth.uid));
    }

    function photoDoc(photoId) { return /databases/$(database)/documents/photos/$(photoId); }
    function likeDoc(photoId) { return /databases/$(database)/documents/photos/$(photoId)/likes/$(request.auth.uid); }

    match /admins/{uid} {
      allow read: if signedIn() && request.auth.uid == uid;
      allow write: if false;
    }

    match /photos/{photoId} {
      allow read: if signedIn();

      allow create: if signedIn()
        && photoId.matches('photo_[0-9]+_[a-z0-9]+')
        && request.resource.data.keys().hasOnly(['storagePath','thumbPath','downloadURL','thumbURL','ownerId','createdAt','likes','width','height','size'])
        && request.resource.data.keys().hasAll(['storagePath','thumbPath','downloadURL','thumbURL','ownerId','createdAt','likes'])
        && request.resource.data.ownerId == request.auth.uid
        && request.resource.data.likes == 0
        && request.resource.data.createdAt == request.time
        && request.resource.data.storagePath.matches('weddings/[a-z0-9-]+/photos/' + photoId + '[.]jpg')
        && request.resource.data.thumbPath.matches('weddings/[a-z0-9-]+/thumbs/' + photoId + '[.]jpg')
        && request.resource.data.downloadURL is string && request.resource.data.downloadURL.size() < 2048
        && request.resource.data.thumbURL is string && request.resource.data.thumbURL.size() < 2048;

      allow update: if signedIn()
        && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['likes'])
        && (
          (request.resource.data.likes == resource.data.likes + 1
             && !exists(likeDoc(photoId)) && existsAfter(likeDoc(photoId)))
          ||
          (request.resource.data.likes == resource.data.likes - 1
             && exists(likeDoc(photoId)) && !existsAfter(likeDoc(photoId)))
        );

      allow delete: if signedIn() && (resource.data.ownerId == request.auth.uid || isAdmin());

      match /likes/{uid} {
        allow read: if signedIn() && (request.auth.uid == uid || isAdmin());
        allow create: if signedIn()
          && request.auth.uid == uid
          && request.resource.data.keys().hasOnly(['createdAt'])
          && request.resource.data.createdAt == request.time
          && getAfter(photoDoc(photoId)).data.likes == get(photoDoc(photoId)).data.likes + 1;
        allow delete: if signedIn() && (
          (request.auth.uid == uid
             && getAfter(photoDoc(photoId)).data.likes == get(photoDoc(photoId)).data.likes - 1)
          || isAdmin());
        allow update: if false;
      }
    }

    match /{document=**} { allow read, write: if false; }
  }
}
```

### Qué permite cada regla

| Acción | Quién | Cómo se garantiza |
|---|---|---|
| **Leer fotos** | Cualquier dispositivo con sesión (invitado anónimo o admin) | `signedIn()`. Sin sesión de Firebase no se puede leer nada. |
| **Crear foto** | Cualquier invitado, **solo a su nombre** | `ownerId == request.auth.uid`, `likes == 0`, `createdAt == request.time` (hora del servidor, no falsificable), solo los campos permitidos y rutas de Storage con formato válido. |
| **Likes** | Cualquier invitado, **uno por foto** | El like es el documento `likes/{uid}` con el propio UID → no puede existir dos veces. El contador `likes` solo puede cambiar **±1** y **únicamente si en la misma operación atómica** se crea (o borra) el like del propio UID (`exists` / `existsAfter`). Cambiar el JavaScript para sumar +10, o sumar sin crear el like, es rechazado. |
| **Modificar foto** | Nadie (salvo el contador de likes, como arriba) | `affectedKeys().hasOnly(['likes'])` → no se puede cambiar `ownerId`, URL ni nada más. |
| **Eliminar foto** | El dueño (`ownerId == request.auth.uid`) o el admin | Un invitado no puede borrar fotos de otro porque su UID no coincide. |
| **Administración** | Usuarios con documento en `admins/{uid}` que **no** sean anónimos | `isAdmin()`. La colección `admins` no se puede escribir desde la app (`allow write: if false`), solo desde la consola. |
| **Todo lo demás** | Nadie | Regla final `/{document=**}` denegada. |

---

## E. Firebase Storage

### Activarlo

1. Menú izquierdo → **Compilación** (*Build*) → **Storage** (o *Bases de datos y almacenamiento* → *Storage*).
2. Pulsa **"Comenzar"** (*Get started*). Si aún estás en el plan Spark te pedirá **actualizar a Blaze** (ver [B](#activar-el-plan-blaze-obligatorio-para-storage)).
3. **Ubicación del bucket:** para que el almacenamiento entre en la **cuota gratuita** ("Always Free": 5 GB almacenados + 100 GB/mes de descarga) elige una región marcada como **sin coste** (*No-cost location*): **`US-CENTRAL1`**, **`US-EAST1`** o **`US-WEST1`**.
   - Una región europea funciona igual de bien pero **no tiene cuota gratuita** (cuesta céntimos al mes para unos pocos GB). La latencia extra desde España a EE. UU. es inapreciable para esta app.
4. **Reglas:** elige **"Iniciar en modo de producción"**.
5. Pulsa **Crear** / **Listo**.
6. Arriba verás la ruta del bucket, p. ej. `gs://PROJECT_ID.firebasestorage.app`. Comprueba que coincide con `storageBucket` de `firebase-config.js`.

### Estructura de carpetas

```text
weddings/
└── iv-angela-2026/
    ├── photos/
    │   ├── photo_1762512345678_abc123.jpg   ← foto comprimida (1800 px)
    │   └── ...
    └── thumbs/
        ├── photo_1762512345678_abc123.jpg   ← miniatura (480 px)
        └── ...
```

Cada archivo tiene en sus metadatos `ownerId = <UID del dispositivo que lo subió>`.

### Reglas completas (`storage.rules`)

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {

    function signedIn() { return request.auth != null; }

    function isAdmin() {
      return signedIn()
        && request.auth.token.firebase.sign_in_provider != 'anonymous'
        && firestore.exists(/databases/(default)/documents/admins/$(request.auth.uid));
    }

    function validUpload(fileName, maxBytes) {
      return signedIn()
        && fileName.matches('photo_[0-9]+_[a-z0-9]+[.]jpg')
        && request.resource.size < maxBytes
        && request.resource.contentType == 'image/jpeg'
        && request.resource.metadata.ownerId == request.auth.uid;
    }

    function canDelete() {
      return signedIn() && (resource.metadata.ownerId == request.auth.uid || isAdmin());
    }

    match /weddings/{weddingId}/photos/{fileName} {
      allow read: if signedIn();
      allow create: if validUpload(fileName, 4 * 1024 * 1024);
      allow update: if false;
      allow delete: if canDelete();
    }

    match /weddings/{weddingId}/thumbs/{fileName} {
      allow read: if signedIn();
      allow create: if validUpload(fileName, 600 * 1024);
      allow update: if false;
      allow delete: if canDelete();
    }

    match /{allPaths=**} { allow read, write: if false; }
  }
}
```

### Cómo impiden que un invitado borre fotos de otro

- Al subir, la regla **obliga** a que `metadata.ownerId` sea el UID real del que sube (no puede poner el de otro).
- Al borrar, se compara el `ownerId` guardado en el archivo con `request.auth.uid`. Si no coincide y no es admin → **denegado**.
- `allow update: if false` → nadie puede sobrescribir una foto existente ni cambiar su `ownerId`.
- Además se limita el tipo (`image/jpeg`), el tamaño (4 MB foto / 600 KB miniatura) y el formato del nombre.
- `isAdmin()` consulta Firestore (**reglas entre servicios**). La primera vez que despliegues, la CLI te preguntará si quieres conceder el permiso necesario → responde **Y** (sí).

> Nota: las `downloadURL` de Firebase contienen un *token* y funcionan para quien tenga el enlace (así pueden mostrarse en `<img>`). Solo las conocen quienes han entrado en la galería.

### CORS (necesario para ⬇️ Descargar y 📦 ZIP)

Para que el navegador pueda descargar las fotos como archivo (y meterlas en un ZIP), el bucket debe permitir peticiones desde tu web. **Sin este paso las fotos se ven, pero "Descargar" las abre en una pestaña y el ZIP falla.**

La forma más sencilla, sin instalar nada:

1. Entra en **<https://console.cloud.google.com>** con la misma cuenta y selecciona tu proyecto arriba.
2. Pulsa el icono **Activar Cloud Shell** (`>_`, arriba a la derecha). Se abre una terminal en el navegador.
3. Pega esto (cambia `PROJECT_ID.firebasestorage.app` por tu bucket, el `storageBucket` de tu config):

   ```bash
   cat > cors.json <<'EOF'
   [{ "origin": ["*"], "method": ["GET"], "maxAgeSeconds": 3600 }]
   EOF
   gcloud storage buckets update gs://PROJECT_ID.firebasestorage.app --cors-file=cors.json
   ```

   (Alternativa con la herramienta antigua: `gsutil cors set cors.json gs://PROJECT_ID.firebasestorage.app`).
4. Comprueba: `gcloud storage buckets describe gs://PROJECT_ID.firebasestorage.app --format="default(cors_config)"`.

Solo se permite `GET` (leer); subir y borrar siguen protegidos por las reglas. Si prefieres restringir el origen, cambia `"*"` por `["https://PROJECT_ID.web.app", "https://PROJECT_ID.firebaseapp.com", "http://localhost:5000"]`.

---

## F. Firebase Authentication

Se usan **dos** proveedores:

- **Anónimo** → para los invitados (sin datos personales; ver [0](#la-decisión-de-seguridad-más-importante-invitados-con-firebase-auth-anónimo)).
- **Correo electrónico/contraseña** → solo para el administrador.

### Activarlo

1. Menú izquierdo → **Compilación** (*Build*) → **Authentication** → **"Comenzar"** (*Get started*).
2. Pestaña **"Método de acceso"** (*Sign-in method*).
3. Pulsa **"Anónimo"** (*Anonymous*) → activa el interruptor → **Guardar**.
4. Pulsa **"Agregar proveedor nuevo"** → **"Correo electrónico/contraseña"** (*Email/Password*) → activa **solo el primer interruptor** (no hace falta "Vínculo de correo electrónico") → **Guardar**.

### Crear el usuario administrador

1. Pestaña **"Usuarios"** (*Users*) → **"Agregar usuario"** (*Add user*).
2. **Email:** uno tuyo real (lo necesitarás si olvidas la contraseña), p. ej. `admin.boda@tudominio.com` o tu Gmail.
3. **Contraseña:** una robusta (12+ caracteres). **No la guardes en ningún archivo del proyecto.**
4. Pulsa **"Agregar usuario"**.
5. En la tabla aparece el usuario con su **UID de usuario** (*User UID*), p. ej. `aBcD1234EfGh5678...`. Cópialo (al pasar el ratón aparece un botón de copiar). Lo usarás en el paso G.

### Cambiar la contraseña

- Desde el panel: en `/admin.html` escribe tu email y pulsa **"¿Has olvidado la contraseña?"** → recibirás un email para cambiarla.
- Desde la consola: **Authentication → Usuarios** → menú **⋮** del usuario → **"Restablecer contraseña"** (envía el email).

### ⚠️ No desactives "Habilitar creación (registro)"

En **Authentication → Configuración → Acciones de usuario** existe la opción *"Habilitar creación (registro)"* (*Enable create (sign-up)*). **Déjala activada**: si la desactivas, los invitados no podrán obtener su sesión anónima y la app mostrará un error al entrar. No supone un riesgo: aunque alguien se cree una cuenta de email usando la API, **una cuenta que no esté en la colección `admins` no tiene ningún permiso extra**.

### Dominios autorizados

**Authentication → Configuración → Dominios autorizados**: deben aparecer `localhost`, `PROJECT_ID.firebaseapp.com` y `PROJECT_ID.web.app` (vienen por defecto). Si usas un dominio propio, añádelo aquí.

### Iniciar sesión en el panel

Abre `https://PROJECT_ID.web.app/admin.html` → email y contraseña → **Iniciar sesión**.

---

## G. Configuración del administrador

Un usuario es administrador si **existe un documento con su UID** en la colección `admins` de Firestore. Esto es mejor que poner UIDs en el código porque:

- No hay que tocar código ni volver a desplegar para añadir o quitar admins.
- Las reglas de Firestore **y** de Storage consultan esa colección.
- Nadie puede añadirse a sí mismo: la colección solo se puede escribir desde la consola.

### Pasos

1. Copia el **UID** del usuario administrador (Authentication → Usuarios). Si ya has intentado entrar en `/admin.html` sin ser admin, el panel también muestra el UID en el mensaje de error.
2. Ve a **Firestore Database → Datos** (*Data*).
3. Pulsa **"+ Iniciar colección"** (*Start collection*).
4. **ID de la colección:** `admins` → **Siguiente**.
5. **ID del documento:** pega el **UID** (¡no pulses "ID automático"!).
6. Añade un campo cualquiera (Firestore no permite documentos vacíos): **Campo** `email`, **Tipo** `string`, **Valor** tu email.
7. **Guardar**.

Para añadir otro administrador (p. ej. el otro novio): crea su usuario en Authentication y añade otro documento en `admins` con su UID. Para quitarlo, borra su documento.

### ¿Qué pasa si un invitado entra en `/admin.html`?

- Verá el formulario de login. Sin email/contraseña válidos no pasa de ahí.
- Aunque manipule el JavaScript para "mostrar" el panel, **las reglas de Firebase rechazan** borrar fotos ajenas o limpiar likes: `isAdmin()` se evalúa en los servidores de Google.
- `/admin.html` no aparece enlazado en ninguna parte de la app, está marcado `noindex` y el service worker no lo guarda en caché.

---

## H. Configuración del código de acceso

En **`public/js/wedding-config.js`**:

```javascript
accessCode: "IvAngela2026",
```

- Se compara **sin distinguir mayúsculas/minúsculas** y quitando espacios (más cómodo para invitados con el móvil: `ivangela2026` también vale).
- Una vez introducido, el dispositivo queda autorizado (`localStorage`). El código **no vuelve a mostrarse** en la interfaz.
- En **ℹ️ Más → Cerrar sesión** se vuelve a pedir el código (las fotos del invitado no se borran y sigue pudiendo eliminarlas si vuelve a entrar desde el mismo navegador).

> ⚠️ **Es una barrera de la interfaz, no una medida de seguridad.** El código está en el JavaScript descargado y cualquiera con conocimientos puede leerlo. Lo que protege las fotos son las **reglas de Firestore y Storage** ([D](#d-firestore-database), [E](#e-firebase-storage)).

---

## I. Configuración de la boda

Todo está centralizado en **`public/js/wedding-config.js`**:

| Qué | Campo |
|---|---|
| Nombres de los novios | `coupleNames: "Iván & Ángela"` |
| Iniciales de la cabecera | `monogram: "I & Á"` |
| Fecha | `date: "2026-11-07"` (formato AAAA-MM-DD) |
| Hora objetivo de la cuenta atrás | `countdownTime: "12:30"` (vacío = medianoche) |
| Código | `accessCode` |
| Ceremonia | `ceremony: { name, address, time, mapsUrl }` |
| Banquete | `reception: { name, address, time, mapsUrl }` |
| Programa del día | `schedule: [{ time: "12:30", title: "Ceremonia", description: "" }, ...]` |
| Información adicional | `extraInfo: [{ title: "Dress code", text: "..." }, ...]` |
| Textos | `texts: { gateTagline, welcome, countdownBefore, countdownToday, countdownAfter, uploadIntro, galleryEmpty }` |
| Colores | `theme: { cream, ink, gold, beige }` |
| Imagen de portada | `heroImage: "assets/images/portada.jpg"` |
| Límites de subida | `upload: { maxFilesPerUpload: 20, maxOriginalSizeMB: 40, maxSide: 1800, quality: 0.78, ... }` |
| Fotos por bloque en la galería | `gallery.pageSize` |
| Nombre y partes del ZIP | `admin: { zipBaseName, zipMaxPhotosPerFile }` |

Los campos vacíos se muestran como **"Por confirmar"** y el botón **📍 Cómo llegar** aparece desactivado.

**📍 Cómo llegar:**
- Si rellenas `mapsUrl`, se usa ese enlace. Para obtenerlo: abre Google Maps → busca el lugar → **Compartir** → **Copiar enlace**.
- Si solo rellenas `address`, se genera automáticamente un enlace de búsqueda de Google Maps.

**Otros elementos (fuera del archivo de configuración):**

- **Nombre de la app instalada y colores de la barra del sistema:** `public/manifest.json` (`name`, `short_name`, `theme_color`, `background_color`) y las etiquetas `<meta name="theme-color">` / `<title>` de `index.html` y `admin.html`.
- **Iconos:** reemplaza los PNG de `public/assets/icons/` manteniendo nombres y tamaños exactos: `icon-192.png` (192×192), `icon-512.png` (512×512), `icon-maskable-512.png` (512×512 con el motivo dentro del 80 % central), `apple-touch-icon.png` (180×180, sin transparencia), `favicon-32.png` (32×32) e `icon.svg`.
- **Imagen de portada:** copia la foto (idealmente JPG < 300 KB, vertical) a `public/assets/images/` y pon su ruta en `heroImage`.
- **Tipografías:** `--font-display` y `--font-body` al principio de `public/css/styles.css` + el `<link>` de Google Fonts en los HTML.

> Tras cambiar cualquier archivo, incrementa `CACHE_VERSION` en `public/service-worker.js` (p. ej. `v1.0.1`) antes de desplegar, para que los móviles que ya tengan la app instalada reciban la versión nueva.

**Reutilizar para otra boda:** crea otro proyecto de Firebase, cambia `firebase-config.js`, `wedding-config.js` (incluido `weddingId`), `manifest.json` e iconos.

---

## J. Probar la aplicación en local

El proyecto **no tiene dependencias** (`npm install` no es necesario). Todo se sirve con la CLI de Firebase.

> ⚠️ Hay que abrirla **a través de un servidor** (`http://localhost:...`), no haciendo doble clic en `index.html` (`file://`): los módulos JavaScript y el service worker no funcionan así.

### Opción 1 (recomendada): local contra tu Firebase real

Requiere haber hecho B–G y [K](#k-firebase-cli) (`firebase login` + `firebase use`).

```bash
cd ruta/al/proyecto/AppBoda
firebase deploy --only firestore,storage   # sube las reglas (una vez)
firebase serve --only hosting              # o: firebase emulators:start --only hosting
```

Abre **<http://localhost:5000>** (y **<http://localhost:5000/admin.html>**). Para parar: `Ctrl + C`.

Las fotos que subas en local van a tu Firebase real; bórralas después desde el panel de administración.

### Opción 2: todo con emuladores (sin tocar Firebase real)

1. En `public/js/firebase-config.js` pon `const USE_EMULATORS = true;` (y **vuelve a ponerlo en `false` antes de desplegar**).
2. Los emuladores necesitan **Java 11+** (<https://adoptium.net>).
3. Ejecuta:

   ```bash
   firebase emulators:start
   ```

4. App: **<http://localhost:5000>** · Interfaz de emuladores: **<http://localhost:4000>**.
5. Para probar el admin: en <http://localhost:4000> → **Authentication** → *Add user* (email/contraseña) → copia su UID → **Firestore** → *Start collection* `admins` → documento con ese UID → campo `email`.
6. Los datos de los emuladores se borran al pararlos.

### Qué comprobar

- [ ] **Acceso:** un código incorrecto muestra *"El código introducido no es correcto."*; el correcto entra. Al recargar ya no lo pide.
- [ ] **Subida:** ➕ Subir → *Elegir fotos* → selecciona varias. Se ven miniaturas y *"6,2 MB → 780 KB"*.
- [ ] **Compresión:** en Storage (consola) los archivos de `photos/` pesan < 1,5 MB y los de `thumbs/` < 100 KB.
- [ ] **Progreso:** *"Subiendo 3 de 8..."* y al final *"¡Fotos subidas correctamente! ❤️"*.
- [ ] **Galería:** las fotos aparecen al instante, también en otra pestaña/dispositivo sin recargar.
- [ ] **Likes:** ❤️ Me gusta suma 1; volver a pulsar lo quita; nunca suma 2 desde el mismo navegador.
- [ ] **Descarga:** ⬇️ Descargar guarda un `.jpg` (si abre una pestaña, falta [CORS](#cors-necesario-para-️-descargar-y--zip)).
- [ ] **Eliminar propias:** en tus fotos aparece 🗑️ Eliminar con confirmación; en las de otros (abre otra ventana de incógnito) no aparece.
- [ ] **Admin:** `/admin.html` → login → estadísticas correctas → eliminar una foto de otro invitado.
- [ ] **ZIP:** 📦 DESCARGAR TODAS → `fotos-boda-ivan-angela.zip` con `fotos-boda-ivan-angela/foto-001.jpg…`.
- [ ] **PWA:** Chrome escritorio muestra el icono de instalar en la barra de direcciones. DevTools (F12) → *Application* → *Manifest* sin errores y *Service Workers* "activated".
- [ ] **Responsive:** DevTools → icono de móvil (Ctrl+Shift+M) → iPhone SE, iPhone 14 Pro, iPad, escritorio.
- [ ] **iPhone / Android:** ver [O](#o-comprobación-desde-móvil) (se prueba mejor ya desplegado, porque requiere HTTPS).

---

## K. Firebase CLI

### 1. Iniciar sesión

```bash
firebase login
```

Se abre el navegador → elige tu cuenta de Google → **Permitir**. Si pregunta por enviar informes de uso (*Allow Firebase to collect CLI usage...*), responde lo que prefieras (`n` para no).

### 2. Conectar la carpeta con tu proyecto

**Este proyecto ya incluye `firebase.json`, las reglas y la carpeta `public/`, así que NO hace falta `firebase init`.** Solo tienes que decirle a la CLI qué proyecto usar. Desde la carpeta del proyecto:

```bash
cd ruta/al/proyecto/AppBoda
firebase use --add
```

- Elige tu proyecto (`PROJECT_ID`) de la lista con las flechas y Enter.
- *What alias do you want to use for this project?* → escribe `default`.

Esto actualiza `.firebaserc`. (Alternativa: edita `.firebaserc` y cambia `TU_PROJECT_ID` por tu ID real).

Comprueba: `firebase projects:list` (tu proyecto aparece marcado como *current*).

### 3. (Solo si quieres o necesitas ejecutar `firebase init`)

Si por algún motivo ejecutas `firebase init` en esta carpeta, responde así para **no sobrescribir** los archivos del proyecto:

| Pregunta | Respuesta |
|---|---|
| *Are you ready to proceed?* | `Y` |
| *Which Firebase features do you want to set up?* (espacio para marcar, Enter para confirmar) | **Firestore**, **Hosting: Configure files for Firebase Hosting…** (no la opción de App Hosting), **Storage**. Opcional: **Emulators** |
| *Project Setup* | **Use an existing project** → tu `PROJECT_ID` |
| *What file should be used for Firestore Rules?* | `firestore.rules` → *File already exists. Overwrite?* **No** |
| *What file should be used for Firestore indexes?* | `firestore.indexes.json` → *Overwrite?* **No** |
| *What do you want to use as your public directory?* | `public` |
| *Configure as a single-page app (rewrite all urls to /index.html)?* | **No** |
| *Set up automatic builds and deploys with GitHub?* | **No** |
| *File public/index.html already exists. Overwrite?* | **No** |
| *What file should be used for Storage Rules?* | `storage.rules` → *Overwrite?* **No** |
| *Emulators: Which emulators?* | **Authentication**, **Firestore**, **Storage**, **Hosting** → puertos por defecto → *Enable Emulator UI?* **Yes** → *Download now?* **Yes** |

Si `init` modifica `firebase.json`, asegúrate de que conserva `"public": "public"` y las secciones `firestore` y `storage`. En caso de duda, recupera el `firebase.json` original de este proyecto.

---

## L. Despliegue

Antes de desplegar comprueba que en `firebase-config.js` está `USE_EMULATORS = false`.

```bash
firebase deploy
```

Despliega **todo**: la web (Hosting), las reglas e índices de Firestore y las reglas de Storage.

La primera vez, al desplegar las reglas de Storage, puede preguntar algo como *"Cloud Storage for Firebase needs an IAM Role to use cross-service rules. Grant the new role?"* → responde **`Y`**. Es lo que permite a `storage.rules` comprobar la colección `admins`.

Comandos individuales:

| Comando | Qué hace | Cuándo usarlo |
|---|---|---|
| `firebase deploy --only hosting` | Publica la carpeta `public/` (HTML, CSS, JS, iconos) | Cambias textos, diseño, configuración de la boda |
| `firebase deploy --only firestore` | Sube `firestore.rules` y `firestore.indexes.json` | Cambias reglas de Firestore |
| `firebase deploy --only firestore:rules` | Solo las reglas de Firestore | |
| `firebase deploy --only storage` | Sube `storage.rules` | Cambias reglas de Storage |

**Probar sin publicar (canal de vista previa):**

```bash
firebase hosting:channel:deploy prueba
```

Te da una URL temporal (7 días) con HTTPS, perfecta para probar desde el móvil antes de publicar.

**Volver a una versión anterior:** Firebase Console → **Hosting** → historial de versiones → ⋮ → **Restaurar** (*Rollback*).

---

## M. URL final

Al terminar `firebase deploy`, la terminal muestra:

```text
✔  Deploy complete!
Hosting URL: https://PROJECT_ID.web.app
```

También la verás en **Firebase Console → Hosting** (también funciona `https://PROJECT_ID.firebaseapp.com`).

Comprueba:
1. `https://PROJECT_ID.web.app` → pantalla de código → entrar → subir una foto → aparece en la galería.
2. `https://PROJECT_ID.web.app/admin.html` → login admin → ves la foto.

**Dominio propio (opcional):** Hosting → **Agregar dominio personalizado** y sigue los pasos DNS; después añádelo a *Authentication → Configuración → Dominios autorizados*.

---

## N. Crear los códigos QR

La app no genera QR: usa cualquier generador. El QR debe apuntar a:

```text
https://PROJECT_ID.web.app
```

Opciones:
- **Chrome (escritorio o Android):** abre la URL → menú ⋮ → **Compartir** → **Código QR** → Descargar.
- Cualquier generador de QR gratuito **estático** (evita los "dinámicos" que redirigen a través de su servidor y pueden caducar o mostrar publicidad).

Consejos de impresión:
- Tamaño mínimo **3 × 3 cm** (mejor 5 × 5 cm en mesas; 10+ cm en carteles).
- Añade debajo el texto: *"Escanea, introduce el código **IvAngela2026** y comparte tus fotos 📸"* (el código tiene que estar en el cartel: la app no lo muestra).
- Dónde colocarlo: **en las mesas**, **en la entrada**, **en carteles**, **en las invitaciones** y **junto al libro de firmas**.
- **Prueba el QR impreso** con un iPhone y un Android antes de imprimir todos.

---

## O. Comprobación desde móvil

### Prueba desde móvil

Hazlo con la app **desplegada** (o un canal de vista previa): la cámara, la instalación PWA y el service worker requieren HTTPS.

#### Android (Chrome)

- [ ] Escanea el QR con la cámara → se abre Chrome → introduce el código.
- [ ] ➕ Subir → *Elegir fotos* → permite elegir de la galería o hacer una foto con la cámara.
- [ ] Selecciona **varias** fotos → se comprimen (ves *"X MB → Y KB"*) → **Subir** → *"Subiendo 1 de N..."*.
- [ ] 📸 Galería: 2 columnas, las fotos aparecen al momento.
- [ ] Visor: deslizar ← → cambia de foto, deslizar hacia abajo o el botón **atrás** del sistema lo cierra.
- [ ] ⬇️ Descargar: abre el menú *Compartir* (elige *Guardar* / Fotos / Drive) o descarga el archivo.
- [ ] Instala la app (ver [P](#p-pwa)) y ábrela desde el icono.
- [ ] La barra inferior no queda tapada por la barra de gestos.

#### iPhone (Safari)

- [ ] Escanea el QR con la **cámara** → abre en **Safari** → código.
- [ ] Subir fotos: aparece *Fototeca / Hacer foto / Seleccionar archivo*. Las fotos HEIC se convierten automáticamente a JPEG.
- [ ] Las fotos verticales salen **derechas** (orientación corregida).
- [ ] ⬇️ Descargar → se abre la hoja de compartir → **Guardar imagen** (va al carrete). Si en su lugar aparece *"¿Descargar?"*, se guarda en la app *Archivos*.
- [ ] Añade a pantalla de inicio (ver [P](#p-pwa)) → abre desde el icono → la cabecera no queda bajo la *Dynamic Island*/*notch* y la barra inferior no queda bajo la barra de inicio.
- [ ] Gira el móvil en horizontal: nada queda debajo de las esquinas redondeadas.

---

## P. PWA

### Comprobar la configuración

En Chrome de escritorio: abre la URL → **F12** → pestaña **Application**:
- **Manifest:** nombre "Iván & Ángela", iconos visibles, sin errores.
- **Service workers:** `service-worker.js` con estado *activated and is running*.
- Opcional: pestaña **Lighthouse** → categoría *Progressive Web App* / *Best practices*.

### Android

Chrome → menú **⋮** → **"Instalar aplicación"** o **"Añadir a pantalla de inicio"**. (Chrome a veces muestra también un aviso automático, o el botón **Instalar ahora** en la sección **ℹ️ Más** de la app).

### iPhone / iPad

Safari → botón **Compartir** (cuadrado con flecha hacia arriba) → **"Añadir a pantalla de inicio"** → **Añadir**. (La sección **ℹ️ Más** de la app muestra estas instrucciones).

### Limitaciones de iOS

- Solo se puede instalar desde **Safari** (en iOS 16.4+ también desde Chrome/Edge mediante *Compartir → Añadir a pantalla de inicio*).
- iOS **no muestra un botón automático de instalar**: hay que hacerlo manualmente (por eso las instrucciones en la app).
- **La app instalada y Safari tienen almacenamiento separado**: al abrir la app instalada por primera vez hay que volver a introducir el código, y cuenta como **otro dispositivo** (las fotos subidas desde Safari solo se pueden borrar desde Safari, y viceversa; el admin puede borrar cualquiera).
- Si el iPhone está en **navegación privada**, al cerrarla se pierde la identidad (no podrá borrar sus fotos después).
- iOS puede borrar los datos de webs que no se usan en semanas; no afecta a las fotos (están en Firebase).

---

## Q. Monitorización de Firebase y costes

### Dónde ver el consumo

| Qué | Dónde |
|---|---|
| **Número de fotografías** | Panel `/admin.html` (y Firestore → Datos → colección `photos`) |
| **Almacenamiento usado** | Panel admin (*Almacenamiento*) y **Storage → Uso** (*Usage*) |
| **Descargas / tráfico de fotos** | **Storage → Uso** → *Bytes descargados* / *Bandwidth* |
| **Lecturas, escrituras, eliminaciones de Firestore** | **Firestore Database → Uso** (*Usage*) |
| **Tráfico de la web** | **Hosting** → gráfico de uso (almacenamiento y transferencia) |
| **Usuarios anónimos creados** | **Authentication → Usuarios** |
| **Resumen y costes** | ⚙️ → **Uso y facturación** (*Usage and billing*) |
| **Alertas de presupuesto** | <https://console.cloud.google.com/billing> → **Presupuestos y alertas** |

### Cuota gratuita (aprox., consulta <https://firebase.google.com/pricing>)

| Servicio | Gratis |
|---|---|
| Firestore | 1 GiB, **50.000 lecturas/día**, 20.000 escrituras/día, 20.000 eliminaciones/día |
| Storage (regiones US sin coste) | **5 GB** almacenados, **100 GB/mes** de descarga |
| Hosting | 10 GB almacenados, 360 MB/día de transferencia |
| Authentication (anónimo + email) | Sin coste para este uso |

### Estimación para una boda

- 150 invitados × 10 fotos = 1.500 fotos × ~0,9 MB ≈ **1,4 GB** en Storage → dentro de los 5 GB.
- Galería: se descargan **miniaturas** (~50 KB). Solo se descarga la foto completa al abrirla en el visor.
- ZIP completo: 1,4 GB de descarga cada vez que lo generas.

### Lo que más puede aumentar el consumo

1. **Descargas de fotos completas** (visor, ⬇️, ZIP). Es la partida más grande. Genera el ZIP las veces necesarias, no a diario.
2. **Lecturas de Firestore:** cada invitado que abre la galería lee ~30 documentos, más al hacer scroll, y +1 por cada foto nueva mientras la tiene abierta. En el pico de la boda se pueden superar las 50.000/día; el exceso cuesta **~0,06 $ por cada 100.000 lecturas** (céntimos).
3. **Región de Storage no gratuita** (Europa): céntimos al mes por GB.
4. **Abuso:** alguien con el código podría subir muchas fotos con un script. Mitigaciones incluidas: límite de tamaño por archivo en reglas, 20 fotos por operación en la interfaz, y el admin puede borrar. Mitigación extra opcional: **App Check** (Firebase Console → App Check, con reCAPTCHA Enterprise) — no incluido para mantener la app simple.

**Recomendado:** crea un presupuesto con alertas al 50 %, 90 % y 100 % de 5 € en Google Cloud Billing.

### Después de la boda

Cuando tengas la copia de seguridad ([R](#r-backup-copia-de-seguridad)), puedes dejar la app como recuerdo o reducir costes a cero borrando las fotos de Storage o eliminando el proyecto (⚙️ → Configuración del proyecto → *Eliminar proyecto*).

---

## R. Backup (copia de seguridad)

### Opción 1 — Panel de administrador (recomendada)

1. Abre `https://PROJECT_ID.web.app/admin.html` **en un ordenador** (Chrome, Edge o Firefox) y entra.
2. Pulsa **📦 DESCARGAR TODAS**.
3. Espera sin cerrar la pestaña: verás *"Descargando N de M…"* y luego *"Generando ZIP…"*.
4. Se descarga **`fotos-boda-ivan-angela.zip`**:

   ```text
   fotos-boda-ivan-angela/
       foto-001.jpg   ← la más antigua
       foto-002.jpg
       ...
   ```

5. Si hay más de 300 fotos (`admin.zipMaxPhotosPerFile`), se generan varias partes: `fotos-boda-ivan-angela-parte-1.zip`, `-parte-2.zip`… (la numeración de las fotos continúa entre partes).
6. Descomprime y guarda la carpeta en **dos sitios** (disco externo + Google Drive/iCloud/OneDrive).

Para solo algunas: marca las casillas → **📦 Descargar seleccionadas**.

> Requiere tener configurado [CORS](#cors-necesario-para-️-descargar-y--zip).

### Opción 2 — Copia completa del bucket (para muchas fotos)

Desde **Cloud Shell** (<https://console.cloud.google.com> → `>_`):

```bash
gcloud storage cp -r gs://PROJECT_ID.firebasestorage.app/weddings/iv-angela-2026/photos ./fotos-boda
zip -r fotos-boda-ivan-angela.zip fotos-boda
cloudshell download fotos-boda-ivan-angela.zip
```

O en tu ordenador con el [Google Cloud SDK](https://cloud.google.com/sdk/docs/install) instalado: `gcloud auth login` y el mismo `gcloud storage cp -r ... ./fotos-boda`.

### Copia de los datos (opcional)

Los likes y fechas están en Firestore. Para una exportación completa: **Firestore → Importar/Exportar** (requiere un bucket de Cloud Storage de destino). Para un recuerdo de la boda normalmente basta con las fotos.

---

# Troubleshooting

### "Firebase no conecta"
- Mensaje *"Falta configurar Firebase"*: aún están los `TU_...` en `public/js/firebase-config.js`.
- Abre la consola del navegador (F12 → *Console*) y busca errores en rojo.
- `auth/invalid-api-key` o `projectId` incorrecto: vuelve a copiar la config ([C](#c-crear-la-aplicación-web-en-firebase)).
- `USE_EMULATORS` debe ser `false` en producción.
- Si abriste el HTML con doble clic (`file://`), usa un servidor ([J](#j-probar-la-aplicación-en-local)).
- Tras un cambio, fuerza la recarga (Ctrl+Shift+R) o incrementa `CACHE_VERSION` del service worker.

### "Permission denied" / "Missing or insufficient permissions"
- ¿Desplegaste las reglas? `firebase deploy --only firestore,storage`. Compara en la consola (Firestore → Reglas, Storage → Reglas) que el texto es el del proyecto.
- `auth/operation-not-allowed` o *"El acceso de invitados no está activado"*: activa **Anónimo** en Authentication → Método de acceso.
- Al **borrar** como invitado: solo funciona con fotos subidas desde ese mismo navegador (ver [limitaciones iOS](#limitaciones-de-ios)).
- Al borrar como **admin** en Storage: ¿aceptaste el rol IAM de reglas entre servicios al desplegar? Vuelve a ejecutar `firebase deploy --only storage` y responde `Y`. ¿La base de datos es `(default)`?
- Al dar like: el contador debe cambiar exactamente ±1 junto con el like; si modificaste `likes.js`, revisa que use `writeBatch`.

### "Las fotos no aparecen"
- Firestore → Datos → ¿existe la colección `photos` con documentos? Si no, la subida falló antes (mira la consola del navegador).
- Storage → ¿están los archivos en `weddings/iv-angela-2026/photos/` y `thumbs/`?
- Si hay archivos en Storage pero no documentos en Firestore, las reglas de Firestore rechazaron el documento (la app borra los archivos en ese caso; revisa la consola).
- ¿El dispositivo tiene conexión? La galería se actualiza en tiempo real; prueba a recargar.

### "No puedo subir fotos"
- Mensaje "HEIC no compatible": en iPhone ocurre muy raramente (Safari convierte a JPEG). Solución: Ajustes → Cámara → Formatos → **Más compatible**, o elegir la foto desde *Fototeca* en lugar de *Archivos*.
- "Supera 40 MB": sube el límite `upload.maxOriginalSizeMB` o usa otra foto.
- Error `storage/unauthorized`: reglas de Storage no desplegadas, bucket distinto al de `storageBucket`, o sesión anónima no iniciada.
- Error de cuota/facturación: comprueba que el proyecto está en plan **Blaze** y la cuenta de facturación está activa.
- Conexión muy lenta en el lugar: las fotos se suben de una en una; si alguna falla se queda en la lista para reintentar.

### "El administrador no puede entrar"
- *"Email o contraseña incorrectos"*: revisa el usuario en Authentication → Usuarios; restablece la contraseña.
- *"Este usuario no es administrador. UID: ..."*: crea en Firestore el documento `admins/<ese UID>` ([G](#g-configuración-del-administrador)). El ID del documento debe ser **exactamente** el UID.
- ¿Está activado el proveedor **Correo electrónico/contraseña**?
- Dominio propio: añádelo a *Dominios autorizados*.

### "La PWA no se instala"
- Debe servirse por **HTTPS** (Firebase Hosting lo hace; `http://localhost` también vale en el ordenador, pero **no** una IP local desde el móvil).
- F12 → Application → **Manifest**: sin errores y con iconos 192 y 512.
- F12 → Application → **Service workers**: registrado y activo. Si no, revisa errores en la consola.
- En iPhone: solo desde Safari (o Chrome/Edge en iOS 16.4+) mediante *Compartir → Añadir a pantalla de inicio*.
- Si ya está instalada, Chrome no vuelve a ofrecer instalarla.

### "En iPhone los botones aparecen desplazados"
- Comprueba que la etiqueta viewport de `index.html` incluye **`viewport-fit=cover`**:
  `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`
- `styles.css` usa `env(safe-area-inset-top)` en la cabecera y `env(safe-area-inset-bottom)` en la barra inferior (variables `--safe-top` / `--safe-bottom`). Si has modificado esas reglas, restáuralas.
- Tras cambiar el CSS, en la app instalada hay que incrementar `CACHE_VERSION`, desplegar, abrir la app, cerrarla del todo y volver a abrirla.
- `apple-mobile-web-app-status-bar-style` está en `default` (barra de estado sobre fondo claro). Si lo cambias a `black-translucent`, el contenido pasa por debajo de la barra de estado y dependerá totalmente de `safe-area-inset-top`.

### "La descarga ZIP falla con muchas fotos"
- **Todas las fotos fallan** → falta **CORS** en el bucket ([E](#cors-necesario-para-️-descargar-y--zip)).
- **Limitaciones del navegador:** el ZIP se construye **en memoria** del navegador. En un ordenador con Chrome suele funcionar bien hasta 1–2 GB por archivo; en móviles (especialmente iPhone) el límite es mucho menor y puede cerrarse la pestaña.
- Soluciones:
  1. Usa un **ordenador**, no el móvil.
  2. Reduce `admin.zipMaxPhotosPerFile` (p. ej. 150) para generar más partes pequeñas.
  3. Descarga por bloques con **Seleccionar** + **Descargar seleccionadas**.
  4. Para miles de fotos, usa `gcloud storage cp -r` ([Backup opción 2](#opción-2--copia-completa-del-bucket-para-muchas-fotos)): no tiene límite y es la opción escalable. (Otra alternativa futura sería una Cloud Function que genere el ZIP en el servidor, pero añade complejidad y coste).
- No bloquees el ordenador ni cambies de pestaña mucho tiempo durante la generación.

---

## T. Arquitectura final

```text
                    ┌─────────────────┐
                    │   INVITADO      │
                    │   Móvil + QR    │
                    └────────┬────────┘
                             │  código de la boda (barrera de interfaz)
                             ▼
                    ┌─────────────────┐
                    │      PWA        │  Firebase Hosting (HTTPS)
                    │   HTML/CSS/JS   │  Service Worker + manifest
                    │  compresión en  │
                    │  el dispositivo │
                    └────────┬────────┘
                             │  sesión ANÓNIMA (UID sin datos personales)
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
        ┌──────────┐   ┌───────────┐   ┌──────────┐
        │ Firestore│   │  Storage  │   │  Auth    │
        │ photos/  │   │ photos/   │   │ Anónimo  │
        │  likes/  │   │ thumbs/   │   │ + Admin  │
        │ admins/  │   │           │   │ (email)  │
        └──────────┘   └───────────┘   └──────────┘
              │   reglas de seguridad (ownerId == uid, admins/{uid})
              └──────────────┼──────────────┘
                             ▼
                    ┌─────────────────┐
                    │ PANEL ADMIN     │  /admin.html
                    │                 │
                    │ Fotos           │
                    │ Likes           │
                    │ Eliminar        │
                    │ Descargar ZIP   │  (JSZip en el navegador)
                    └─────────────────┘
```

Flujo de una subida:

```text
Elegir fotos → <img> decodifica (orientación EXIF) → <canvas> 1800 px → JPEG 78 %
            → miniatura 480 px → Storage (thumbs/ + photos/, metadata.ownerId = uid)
            → Firestore photos/{id} (createdAt = hora servidor) → onSnapshot → galería de todos
```

---

## U. CHECKLIST FINAL

```text
[ ] Proyecto Firebase creado
[ ] Plan Blaze activado + alerta de presupuesto
[ ] Firebase Web configurado
[ ] Firestore activado
[ ] Reglas Firestore desplegadas
[ ] Storage activado
[ ] Reglas Storage desplegadas
[ ] CORS del bucket configurado
[ ] Authentication activado (Anónimo + Email/Password)
[ ] Usuario administrador creado
[ ] UID administrador configurado (colección admins)
[ ] firebaseConfig configurado
[ ] Código de boda configurado
[ ] Lugares y horarios añadidos en wedding-config.js
[ ] Aplicación probada localmente
[ ] Subida de fotos probada
[ ] Compresión probada
[ ] Galería probada
[ ] Likes probados
[ ] Descargas probadas
[ ] Eliminación de fotos propias probada
[ ] Panel administrador probado
[ ] Descarga ZIP probada
[ ] PWA probada en Android
[ ] PWA probada en iPhone
[ ] Firebase Hosting desplegado
[ ] URL final comprobada
[ ] QR generado
[ ] Reglas de seguridad revisadas
[ ] Copia de seguridad realizada
```
