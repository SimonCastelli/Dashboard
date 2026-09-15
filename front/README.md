# Dashboard personal

Front estático: HTML + CSS + JavaScript sin dependencias ni build. Abrí `front/index.html` en el navegador o serví la carpeta (`npx serve front`).

## Pantallas
- `index.html` — Hoy: calendario con vista Hoy/Semana/Mes, bandeja unificada, próximas clases, tareas, hábitos y objetivos.
- `facultad.html` — Horario de cursada: vista semana (grilla) y vista por día (rectángulos con horario y aula).
- `bandeja.html` — Correo de las tres cuentas en una lista, con filtro por cuenta y "→ Tarea".

## Archivos
- `assets/industry.css` — tokens y componentes del design system Industry (no editar a mano; viene del sistema).
- `assets/app.css` — layout del dashboard; responsive, con barra inferior y FAB por debajo de 900px.
- `assets/app.js` — captura rápida (⌘/Ctrl+N), check de tareas, filtro de cuentas, cambio semana/día.

Los datos son de muestra y están en el HTML. El próximo paso natural es reemplazarlos por la API de Google Calendar y Gmail.
