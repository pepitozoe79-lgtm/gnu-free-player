<div align="center">
  <img src="https://images.unsplash.com/photo-1485846234645-a62644f84728?q=80&w=2659&auto=format&fit=crop" alt="Curator Banner" width="100%" style="border-radius:15px; margin-bottom: 20px;">
  
  # 📽️ Curator Media Server

  Un media server moderno, responsivo y ultra veloz inspirado en las grandes plataformas de streaming. Anteriormente conocido como "GNU Free Player", ahora renace en NodeJS con una estética premium.

  ## 🚀 Instalación Automática (Estilo CasaOS)

  Instala, configura y levanta el servidor completo con un solo comando en tu terminal de Ubuntu/Debian:

  ```bash
  curl -fsSL https://raw.githubusercontent.com/pepitozoe79-lgtm/gnu-free-player/main/install.sh | sudo bash
  ```

  Una vez que termine, te dirá tu IP, puerto y clave maestra en pantalla. ¡Así de fácil!

  ## 🗑️ Desinstalación Rápida

  Si alguna vez decides remover todo el ecosistema (sin borrar tus videos almacenados), basta con correr:

  ```bash
  curl -fsSL https://raw.githubusercontent.com/pepitozoe79-lgtm/gnu-free-player/main/uninstall.sh | sudo bash
  ```

  ---

  ## 📂 Arquitectura del Proyecto-v2.0.0

  [![Security](https://img.shields.io/badge/Security-JWT_|_Path_Traversal_Protected-green.svg?style=for-the-badge)]()
  [![Docker Ready](https://img.shields.io/badge/Docker-Ready-2496ED.svg?style=for-the-badge&logo=docker)]()
  [![Node.js](https://img.shields.io/badge/Node.js-v20_LTS-339933.svg?style=for-the-badge&logo=nodedotjs)]()
</div>

<br>

Bienvenido a **MyMediaServer v2.0.0**, la evolución premium de tu cine en casa personal. Construido sobre Node.js, este proyecto no es solo un servidor de archivos; es una plataforma de streaming VOD (Video On Demand) completa con una de las interfaces más hermosas, seguras y robustas de la comunidad Open Source. Olvídate de configuraciones pesadas como Plex o Jellyfin. Ligero, portátil y brutalmente seguro.

---

## 🌟 ¿Qué hace a la v2.0.0 tan especial?

### 🛡️ Seguridad de Grado Empresarial (Enterprise Security)
* **Autenticación JWT Estricta:** Todas las rutas, incluyendo el streaming de video nativo, están protegidas con JSON Web Tokens de sesión.
* **Tolerancia a Zero-Days y Path Traversal:** Algoritmos avanzados aíslan completamente la carpeta `/media`, bloqueando cualquier intento de leer archivos del sistema (como `/etc/passwd`).
* **Protección Anti-Bruteforce:** Middleware de escalado progresivo y Rate Limiting inteligente (bloqueo tras 5 intentos cada 15 min).
* **Bloqueo de Concurrencia (File Locking):** Previene la corrupción de bases de datos JSON (como `users.json`) cuando múltiples usuarios o administradores escriben al mismo tiempo.

### 🎨 Experiencia "Curator" Premium (Glassmorphism)
Interfaz rediseñada desde cero inspirada en Apple TV+ y el nuevo diseño de Netflix.
* Diseño ultra inmersivo con estética oscura "Glassmorphism" y fondos difuminados reactivos.
* Motor dinámico de portadas automáticas y sección funcional de **Continue Watching**.
* Reproductor de video de ultra-alta eficiencia que guarda el minuto y segundo exacto en la caché local (`localStorage`) de manera silenciosa.

### 🛰️ Live IPTV Integrado
Soporte absoluto para listas M3U / M3U8. Renderización de la grilla de canales extrayendo etiquetas y logos dinámicos en tiempo real para emular experiencias de TV nativas.

---

## 🚀 Instalación en 1-Clic para la Nube (Linux VPS / CasaOS)

¿Tienes un servidor Ubuntu/Debian? ¿Una VPS en la nube? Puedes desplegar el servidor en menos de 20 segundos. Este script actualizará el servidor, instalará Node.js, descargará y configurará MyMediaServer como un servicio perpetuo mediante `systemd`.

```bash
curl -fsSL https://raw.githubusercontent.com/pepitozoe79-lgtm/MyMediaServer-v2.0.0/main/install.sh | sudo bash
```

Una vez instalado, ingresa a `http://TU-IP-SERVIDOR:3000` con:
* **Usuario:** `admin`
* **Contraseña:** `admin123` *(Se recomienda encarecidamente cambiarla tras el primer inicio)*

---

## 🐳 Despliegue con Docker (Modo Producción HTTPS)

Si prefieres usar contenedores de Docker, el repositorio ya cuenta con `Dockerfile` y `docker-compose.yml`. El stack incluye un contenedor de aplicación NodeJS puro, y un servidor Nginx diseñado como Reverse Proxy.

```bash
# Clonar el proyecto
git clone https://github.com/pepitozoe79-lgtm/MyMediaServer-v2.0.0.git
cd MyMediaServer-v2.0.0

# Levantar con Docker Compose (-d para background)
docker-compose up -d --build
```

El servidor quedará disponible y mapeado a través de Nginx en los puertos 80 y 443 (asegúrate de colocar tus certificados TLS válidos en la carpeta `certs/`).

---

## 💻 Entorno Local (Windows / MacOS / Raspberry Pi)

1. Asegúrate de tener instalado [Node.js](https://nodejs.org/).
2. Abre la terminal, navega a tu carpeta preferida y clona el proyecto:
```powershell
git clone https://github.com/pepitozoe79-lgtm/MyMediaServer-v2.0.0.git
cd MyMediaServer-v2.0.0
```
3. Instala los paquetes dependencias e inicializa el servidor:
```powershell
npm install
npm start
```

---

## 📂 Arquitectura Interna y Organización
Siente el poder del auto-gestor. Una vez encendido por primera vez, el servidor generará inteligentemente su estructura local de carpetas. Arrastra y suelta tus archivos MP4, MKV o AVI.

```text
MyMediaServer/
├── media/           🎬 (Las películas y subcarpetas van aquí)
│   ├── Peliculas/ 
│   ├── Series/    
│   └── Musica/      
├── public/          🎨 (Frontend Vanilla JS/CSS interactivo)
├── server.js        🧠 (La API protegida por JWT)
├── users.json       🔐 (Base de datos Autogenerada de cuentas)
└── iptv.json        📺 (Configuración de canales en memoria)
```
💡 **Tip de Portadas:** ¿Quieres darle elegancia a tu biblioteca? Coloca cualquier imagen JPG con el nombre `poster.jpg` dentro de la subcarpeta local de una película y el servidor la usará inteligentemente en el Panel Central en lugar del SVG generalizado.

---

## 🗺️ Roadmap y Mirando al Futuro

El viaje hacia el código limpio nunca termina. Nos encontramos trabajando activamente en las próximas fases del ecosistema:

### 🔜 v2.1.0 
- [ ] 🔔  Web Push notifications para informar de nuevos contenidos.
- [ ] 📊  Dashboard de estadísticas avanzadas de streaming.
- [ ] 🌍  Adaptación i18n completa para multi-lenguaje.

### 🚀 v3.0.0 
- [ ] ⚙️  Transcodificación de video automática en tiempo real utilizando FFmpeg.
- [ ] 🎬  Sincronización via API TMDB (The Movie Database) para metadata automática.
- [ ] 📱  Arquitectura PWA (Progressive Web App) y capacidades offline mejoradas.
- [ ] 🧩  Sistema de inyección de módulos (Ecosystem Extensions).

---

## 💖 Agradecimientos y Comunidad

¿Encontraste un problema? ¡Abre un [Issue](https://github.com/pepitozoe79-lgtm/MyMediaServer-v2.0.0/issues)!
¿Hiciste un parche genial? ¡Mandanos un Pull Request!

Este proyecto v2 ha sido rediseñado con sumo cuidado, dedicando horas a aplicar las convenciones de robustez, ciberseguridad, y las metodologías estándar en la modernización de Javascript puro, todo esto por petición comunitaria en Home Labs. 

**Hecho con ❤️ para la increíble comunidad de Home Servers Open Source.**
