const fs = require('fs');
const globe_dts = fs.readFileSync('OrbitWatch-Containerized-main/node_modules/react-globe.gl/dist/index.d.ts', 'utf8');
console.log(globe_dts.includes('pathsData'));
console.log(globe_dts.match(/path[A-Za-z0-9_]+/g)?.filter((v, i, a) => a.indexOf(v) === i).join('\n'));
