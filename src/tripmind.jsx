import { useState, useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { UI as _UI, t as _t, getLang as _getLang } from "./constants/i18n.js";

// ── Extracted modules ─────────────────────────────────────────────────────────
// These modules contain code extracted from this monolith for better organization.
// They can be imported individually for tree-shaking, or via barrel index files.
//
// Module structure:
//   constants/  → config, i18n, photos, personalities, transit, css
//   utils/      → helpers, hiddenGems, budget, personality, auth, timing
//   components/ → Primitives, DayMap, NotifSetupCard, panels
//   hooks/      → useDarkMode, useActivityPhoto, useDestImg, useTripSync
//   engines/    → optimizeDayPlan
//   ai/         → callAI, repairJSON
//   geo/        → geocode, haversine, routeOptimize
//   screens/    → LandingScreen, Loading, BottomNav, Settings, etc.
//
// NOTE: The large components (Setup, Trip, HomeScreen, MyTripsScreen,
// TripLandingScreen, App) remain in this file due to deep state coupling.
// Future refactoring should extract them once state management is centralized.

// ── Dark mode detection ─────────────────────────────────────────────────────
function useDarkMode(){
  const [dark,setDark]=useState(()=>{
    try{
      const saved=localStorage.getItem("tm_theme");
      if(saved==="dark") return true;
      if(saved==="light") return false;
    }catch(_){}
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches||false;
  });
  useEffect(()=>{
    const html=document.documentElement;
    html.setAttribute("data-theme",dark?"dark":"light");
    try{localStorage.setItem("tm_theme",dark?"dark":"light");}catch(_){}
  },[dark]);
  useEffect(()=>{
    const mq=window.matchMedia?.("(prefers-color-scheme: dark)");
    if(!mq) return;
    function onChange(e){
      // Only follow system if user hasn't manually overridden
      const saved=localStorage.getItem("tm_theme");
      if(!saved) setDark(e.matches);
    }
    mq.addEventListener("change",onChange);
    return()=>mq.removeEventListener("change",onChange);
  },[]);
  return [dark,setDark];
}

const API = "/api/messages";
const MODEL = "claude-sonnet-4-5-20251029";
const INTERESTS = ["Food & Dining","Culture","History","Nightlife","Nature","Art","Shopping","Hidden Spots","Architecture","Sports","Wellness","Photography"];
const AGE_GROUPS = ["18-25","26-40","41-60","60+","Mixed / Family"];
const GOOGLE_PLACES_KEY = "PASTE_YOUR_KEY_HERE";

// ── Language system ────────────────────────────────────────────────────────────
const LANGUAGES={
  en:{name:"English",flag:"🇬🇧"},
  de:{name:"Deutsch",flag:"🇩🇪"},
  fr:{name:"Français",flag:"🇫🇷"},
  es:{name:"Español",flag:"🇪🇸"},
  it:{name:"Italiano",flag:"🇮🇹"},
  pt:{name:"Português",flag:"🇵🇹"},
  nl:{name:"Nederlands",flag:"🇳🇱"},
  pl:{name:"Polski",flag:"🇵🇱"},
  ru:{name:"Русский",flag:"🇷🇺"},
  zh:{name:"中文",flag:"🇨🇳"},
  ja:{name:"日本語",flag:"🇯🇵"},
  ko:{name:"한국어",flag:"🇰🇷"},
  ar:{name:"العربية",flag:"🇸🇦"},
  tr:{name:"Türkçe",flag:"🇹🇷"},
  sv:{name:"Svenska",flag:"🇸🇪"},
  da:{name:"Dansk",flag:"🇩🇰"},
  no:{name:"Norsk",flag:"🇳🇴"},
  fi:{name:"Suomi",flag:"🇫🇮"},
  cs:{name:"Čeština",flag:"🇨🇿"},
  hu:{name:"Magyar",flag:"🇭🇺"},
  ro:{name:"Română",flag:"🇷🇴"},
  uk:{name:"Українська",flag:"🇺🇦"},
  he:{name:"עברית",flag:"🇮🇱"},
  hi:{name:"हिन्दी",flag:"🇮🇳"},
  th:{name:"ภาษาไทย",flag:"🇹🇭"},
  vi:{name:"Tiếng Việt",flag:"🇻🇳"},
  id:{name:"Bahasa Indonesia",flag:"🇮🇩"},
};
// Use imported translations from constants/i18n.js
const UI=_UI;
function t(lang,key){ return _t(lang,key); }
function getLang(){ return _getLang(); }
function getUserProfile(){ try{ return JSON.parse(localStorage.getItem("tm_user")||"{}"); }catch(_){ return {}; } }
function getInitials(name){
  if(!name) return "?";
  const parts=name.trim().split(/\s+/);
  if(parts.length===1) return parts[0][0].toUpperCase();
  return (parts[0][0]+parts[parts.length-1][0]).toUpperCase();
}
function InitialsAvatar({name,size=36,fontSize=".9rem",style={}}){
  const initials=getInitials(name);
  return(
    <div style={{width:size,height:size,borderRadius:"50%",background:"linear-gradient(135deg,#111,#555)",display:"inline-flex",alignItems:"center",justifyContent:"center",flexShrink:0,color:"#fff",fontWeight:800,fontSize,letterSpacing:"-.01em",fontFamily:"inherit",...style}}>
      {initials}
    </div>
  );
}
// Picsum gives real photos by seed - deterministic so no flicker on re-render
function picsum(seed, w, h){ return `https://picsum.photos/seed/${encodeURIComponent(seed)}/${w||600}/${h||400}`; }
const DEST_PHOTO_MAP={
  // ── SPANIEN ──────────────────────────────────────────────────────────────
  "madrid":"photo-E6hOXV2aVMw",                       // Palacio Real
  "barcelona":"photo-1539037116277-4db20889f2d4",     // Sagrada Família
  "seville":"photo-4HWBIUH9yRM",                      // Giralda / Plaza de España
  "sevilla":"photo-4HWBIUH9yRM",
  "palma":"photo-O0xdBP5yCqo",                        // Kathedrale La Seu
  "mallorca":"photo-O0xdBP5yCqo",
  "bilbao":"photo-LmZD5cjDsAg",                       // Guggenheim Museum
  "granada":"photo-gM1lnTTdWuE",                      // Alhambra
  "valencia":"photo-5-O5f9NxD2s",                     // Ciudad de las Artes
  "malaga":"photo-LIfZI4f-Kbw",                       // Alcazaba
  "ibiza":"photo-QXz_1KjsLyo",                        // Dalt Vila
  "san sebastian":"photo-j6hYykvI848",                // La Concha Strandbucht
  "donostia":"photo-j6hYykvI848",
  // ── FRANKREICH ───────────────────────────────────────────────────────────
  "paris":"photo-1502602898657-3e91760cbb34",         // Eiffelturm
  "nice":"photo-G8Q4z9ARrWc",                         // Promenade des Anglais
  "nizza":"photo-G8Q4z9ARrWc",
  "lyon":"photo-BRmljsMIvlc",                         // Basilika Fourvière
  "marseille":"photo-hGd_0-nl1NA",                    // Notre-Dame de la Garde
  "bordeaux":"photo-_c_-wJtwKzk",                     // Place de la Bourse Wasserspiegel
  "strasbourg":"photo-13iG5zydUlg",                   // Petite France
  "straßburg":"photo-13iG5zydUlg",
  "mont-saint-michel":"photo-ePHhUrKntEQ",            // Klosterinsel
  "mont saint michel":"photo-ePHhUrKntEQ",
  "cannes":"photo-5wSTD4OwPFo",                       // Palais des Festivals
  "versailles":"photo-zl1POgno4rc",                   // Schloss Versailles
  "chamonix":"photo-4AU8t0aQHVI",                     // Mont Blanc
  // ── ITALIEN ──────────────────────────────────────────────────────────────
  "rome":"photo-1552832230-c0197dd311b5",             // Kolosseum
  "roma":"photo-1552832230-c0197dd311b5",
  "venice":"photo-hFXZ5cNfkOk",                       // Rialto / Markusplatz
  "venezia":"photo-hFXZ5cNfkOk",
  "florence":"photo-JnTdxjelx6E",                     // Duomo Florenz
  "firenze":"photo-JnTdxjelx6E",
  "milan":"photo-dgLr77nLctg",                        // Mailänder Dom
  "milano":"photo-dgLr77nLctg",
  "naples":"photo-deB8hUHsrf0",                       // Vesuv / Bucht
  "napoli":"photo-deB8hUHsrf0",
  "verona":"photo-XvPsA9Riev4",                       // Arena di Verona
  "pisa":"photo-c2VqfO8bLPg",                         // Schiefer Turm von Pisa
  "positano":"photo-TtDa6GZBIYI",                     // Bunte Häuser Amalfi
  "amalfi":"photo-TtDa6GZBIYI",
  "palermo":"photo-khX7PV12lno",                      // Kathedrale Palermo
  "burano":"photo-k-7nACY1gC0",                       // Bunte Fischerhäuser
  // ── DEUTSCHLAND ──────────────────────────────────────────────────────────
  "berlin":"photo-EmGJdoIvp3A",                       // Brandenburger Tor
  "munich":"photo-2IquTdfEsZ0",                       // Frauenkirche / Marienplatz
  "münchen":"photo-2IquTdfEsZ0",
  "hamburg":"photo-DAaZK_Z4Arg",                      // Elbphilharmonie
  "cologne":"photo-zd0Ie1fxEGA",                      // Kölner Dom
  "köln":"photo-zd0Ie1fxEGA",
  "dresden":"photo-m9qz1NE1b5k",                      // Frauenkirche Dresden
  "frankfurt":"photo-_H_SVUueJAo",                    // Skyline Mainhattan
  "heidelberg":"photo-9Ziy3r0itK4",                   // Heidelberger Schloss
  "neuschwanstein":"photo-kd3qRzMwDjQ",               // Schloss Neuschwanstein
  "füssen":"photo-kd3qRzMwDjQ",
  "rothenburg":"photo-nFWB881HKCk",                   // Plönlein Fachwerk
  "konstanz":"photo-SIuEigbNSmU",                     // Bodensee
  // ── GRIECHENLAND ─────────────────────────────────────────────────────────
  "athens":"photo-MH6sSrsXDm4",                       // Akropolis
  "santorini":"photo-1570077188670-e3a8d69ac5ff",     // Blaue Kuppelkirchen Oia
  "oia":"photo-1570077188670-e3a8d69ac5ff",
  "mykonos":"photo-gfIpj-zjOcc",                      // Windmühlen Kato Mili
  "crete":"photo-EZBfg-MjfQ0",                        // Palast von Knossos
  "heraklion":"photo-EZBfg-MjfQ0",
  "rhodes":"photo-8Ppjz5WQdcc",                       // Großmeisterpalast Rhodos
  "rhodos":"photo-8Ppjz5WQdcc",
  "thessaloniki":"photo-LMThkOqsix0",                 // Weißer Turm
  "meteora":"photo-OtNKUzu9ldQ",                      // Schwebende Klöster
  "corfu":"photo-mHbrbdv5f30",                        // Alte Festung Korfu
  "korfu":"photo-mHbrbdv5f30",
  "zakynthos":"photo-JfWq6XoQvYg",                    // Navagio-Bucht Schiffswrack
  "zante":"photo-JfWq6XoQvYg",
  "delphi":"photo-ERqJKCA16hU",                       // Apollon-Heiligtum
  // ── PORTUGAL ─────────────────────────────────────────────────────────────
  "lisbon":"photo-OW-NsDPmSQo",                       // Torre de Belém / Lissabon
  "porto":"photo-oyjIQC8IzCU",                        // Ponte Dom Luís / Ribeira
  "sintra":"photo-ci19YINguoc",                       // Palácio Nacional da Pena
  "albufeira":"photo-fX6_gCGSLXA",                    // Praia da Marinha Felsen
  "funchal":"photo-Dc0obOTfK2M",                      // Monte Palace Madeira
  "madeira":"photo-Dc0obOTfK2M",
  "cascais":"photo-Rl7l7Llp2s0",                      // Boca do Inferno
  "evora":"photo-1557332799-58b90a3d0862",            // Römischer Tempel Diana
  "évora":"photo-1557332799-58b90a3d0862",
  "coimbra":"photo-g9ZuO5bWKVw",                      // Universidade de Coimbra
  "ponta delgada":"photo-_UINDYmm0Uo",               // Sete Cidades Azoren
  "azores":"photo-_UINDYmm0Uo",
  "aveiro":"photo-V02YPBI0bwg",                       // Moliceiro-Boote
  // ── ÖSTERREICH ───────────────────────────────────────────────────────────
  "vienna":"photo-1516550893923-42d28e5677af",        // Schönbrunn / Stephanskdom
  "wien":"photo-1516550893923-42d28e5677af",
  "salzburg":"photo-yqj_q2SygaI",                     // Festung Hohensalzburg
  "innsbruck":"photo-oeqMjVpvBxE",                    // Goldenes Dachl
  "hallstatt":"photo-AwXz7lGkOqM",                    // Dorfansicht vom See
  "graz":"photo-1541961017811-14df4ccf0399",          // Grazer Uhrturm
  "linz":"photo-kEqeTPBx37k",                         // Lentos Kunstmuseum
  "bregenz":"photo-1506905925346-21bda4d32df4",       // Seebühne Bregenzer Festspiele
  "zell am see":"photo-1501854140801-50d01698950b",   // Zeller See mit Bergen
  "klagenfurt":"photo-G5Gf1QDQXAQ",                   // Lindwurm-Brunnen
  "st. anton":"photo-1489824904134-2fa675b6b8b2",     // Skipisten Arlberg
  "st anton":"photo-1489824904134-2fa675b6b8b2",
  // ── SCHWEIZ ──────────────────────────────────────────────────────────────
  "zurich":"photo-omiTbS-nb_M",                       // Grossmünster / Limmat
  "zürich":"photo-omiTbS-nb_M",
  "geneva":"photo-1578592575049-64bfac3e7cce",        // Jet d'Eau
  "genf":"photo-1578592575049-64bfac3e7cce",
  "lucerne":"photo-DHJe5GNs6pE",                      // Kapellbrücke
  "luzern":"photo-DHJe5GNs6pE",
  "zermatt":"photo-9Egp-pZyAIE",                      // Matterhorn
  "bern":"photo-CpkOjOop3kA",                         // Zytglogge / Altstadt
  "interlaken":"photo-1431794062232-2a99a5431130",    // Eiger Mönch Jungfrau
  "basel":"photo-QLpNJnM7MeA",                        // Basler Münster
  "lauterbrunnen":"photo-PNIkBV_3H08",               // Staubbachfall
  "st. moritz":"photo-1484100356142-db6ab6244067",    // Gefrorener See Winter
  "st moritz":"photo-1484100356142-db6ab6244067",
  // ── NIEDERLANDE ──────────────────────────────────────────────────────────
  "amsterdam":"photo-1534351590666-13e3e96b5702",     // Grachten Giebelhäuser
  "rotterdam":"photo-t-j22ysiAL8",                    // Erasmusbrücke
  "den haag":"photo-X3FNkVH6CJg",                     // Binnenhof
  "the hague":"photo-X3FNkVH6CJg",
  "utrecht":"photo-j4XgyGtSX98",                      // Domturm Kanal
  "keukenhof":"photo-LB6zkzdCpds",                    // Tulpenfelder
  "kinderdijk":"photo-rYxuV6G5asA",                   // Historische Windmühlen
  "delft":"photo-v7jgPtKDSEk",                        // Marktplatz mit Rathaus
  "maastricht":"photo-k8mlJjj2HA4",                   // Vrijthof
  "eindhoven":"photo-wKbFhXOzDLw",                    // Evoluon Gebäude
  "groningen":"photo-bBiuSdAZqmA",                    // Martiniturm
  // ── KROATIEN ─────────────────────────────────────────────────────────────
  "dubrovnik":"photo-3mVr2eUyA_Q",                    // Stadtmauer Altstadt
  "split":"photo-8hUurKdQorc",                        // Diokletianpalast
  "zadar":"photo-BVhYCb2eKU0",                        // Meeresorgel Stufen
  "hvar":"photo-SwX3bwuXaFE",                         // Spanische Festung Bucht
  "plitvice":"photo-NfkWUOkB78c",                     // Wasserfälle Veliki Slap
  "plitvice lakes":"photo-NfkWUOkB78c",
  "pula":"photo-Y3WDkOuqipc",                         // Amphitheater Pula Arena
  "rovinj":"photo-bk_0uB0GCf0",                       // Kirche Hl. Euphemia Skyline
  "zagreb":"photo-cGMvmE1QLHM",                       // Markuskirche Wappendach
  "korcula":"photo-z52TflEI7PA",                      // Mittelalterliche Gassen
  "sibenik":"photo-2J_kfJ3MTFI",                      // Kathedrale des Hl. Jakob
  // ── VEREINIGTES KÖNIGREICH ───────────────────────────────────────────────
  "london":"photo-1513635269975-59663e0ac1ad",        // Tower Bridge / Big Ben
  "edinburgh":"photo-CgFyNhXa2Ig",                    // Edinburgh Castle
  "bath":"photo-GXEZuKqKMdo",                         // Römische Bäder
  "oxford":"photo-U0qqO0hh3cA",                       // Radcliffe Camera
  "cambridge":"photo-BLvBGCNqSXE",                    // King's College Chapel
  "stonehenge":"photo-qYMa2Db_jK4",                   // Steinkreis
  "liverpool":"photo-vqKhPFV5-0E",                    // Royal Albert Dock
  "york":"photo-1518476374098-5d17f4c2e966",          // The Shambles
  "belfast":"photo-SIFVJQVJrA4",                      // Titanic Belfast Museum
  "isle of skye":"photo-1467269204594-9661b134dd2b",  // Old Man of Storr
  "skye":"photo-1467269204594-9661b134dd2b",
  // ── SCHWEDEN ─────────────────────────────────────────────────────────────
  "stockholm":"photo-J3s5a4qIwxQ",                    // Gamla Stan
  "gothenburg":"photo-ZKBEgNcBUAE",                   // Poseidon-Brunnen
  "göteborg":"photo-ZKBEgNcBUAE",
  "malmö":"photo-Hw2Ppv9Wt9M",                        // Turning Torso
  "malmo":"photo-Hw2Ppv9Wt9M",
  "kiruna":"photo-1476610182048-b716b8518aae",        // Polarlichter / Eishotel
  "visby":"photo-HWOxnDMFhMY",                        // Mittelalterliche Stadtmauer
  "uppsala":"photo-Dh-Cl8i02ak",                      // Domkyrka Uppsala mit Fluss
  "abisko":"photo-1476610182048-b716b8518aae",        // Lapporten Bergformation
  // ── POLEN ────────────────────────────────────────────────────────────────
  "warsaw":"photo-lhbVCGWtHOQ",                       // Schlossplatz Sigismundsäule
  "warschau":"photo-lhbVCGWtHOQ",
  "krakow":"photo-eDKdahLKB_M",                       // Tuchhallen Hauptmarkt
  "kraków":"photo-eDKdahLKB_M",
  "gdansk":"photo-E_JBmCH83Z0",                       // Krantor Mottlau
  "gdańsk":"photo-E_JBmCH83Z0",
  "wroclaw":"photo-TpJGPtgH1ss",                      // Bunte Häuser Großer Ring
  "wrocław":"photo-TpJGPtgH1ss",
  "malbork":"photo-v0BQOA_aBeo",                      // Ordensburg Marienburg
  "marienburg":"photo-v0BQOA_aBeo",
  "torun":"photo-t1HpkwsWMIs",                        // Gotische Altstadt / Teutonenburg
  "toruń":"photo-t1HpkwsWMIs",
  "zakopane":"photo-1489824904134-2fa675b6b8b2",      // Tatra-Gebirge
  // ── NORWEGEN ─────────────────────────────────────────────────────────────
  "oslo":"photo-1531366936337-7c912a4589a7",          // Opernhaus / Hafen
  "bergen":"photo-BIrN1pkBBng",                       // Bryggen Holzfront
  "trondheim":"photo-4M8aFdC3qbo",                    // Nidarosdom
  "tromsø":"photo-eVhDc-oT_Ww",                       // Eismeerkathedrale
  "tromso":"photo-eVhDc-oT_Ww",
  "stavanger":"photo-vPEGR3XLOUI",                    // Lysefjord Preikestolen
  "preikestolen":"photo-vPEGR3XLOUI",
  "ålesund":"photo-ZMt3AGaENcg",                      // Jugendstil-Häuser Aksla
  "alesund":"photo-ZMt3AGaENcg",
  "geiranger":"photo-eUPr-K2HzfY",                    // Geirangerfjord Wasserfälle
  "lofoten":"photo-FnWiGvlbwmI",                      // Rorbuer Reine
  "flåm":"photo-tcRRNN5uKT4",                         // Flåmbahn Berglandschaft
  "flam":"photo-tcRRNN5uKT4",
  // ── TSCHECHIEN ───────────────────────────────────────────────────────────
  "prague":"photo-68cHAtrDd1M",                       // Karlsbrücke
  "prag":"photo-68cHAtrDd1M",
  "cesky krumlov":"photo-D-MnDVoipng",                // Schlossanlage Moldau
  "český krumlov":"photo-D-MnDVoipng",
  "karlovy vary":"photo-YNMxdHCsXMU",                 // Marktkolonnade
  "karlsbad":"photo-YNMxdHCsXMU",
  "kutna hora":"photo-z1Fy0eYB5vY",                   // Ossarium Kuttenberg
  "kuttenberg":"photo-z1Fy0eYB5vY",
  "telc":"photo-vB0kFxXB4-E",                         // Märchenhafter Marktplatz
  "telč":"photo-vB0kFxXB4-E",
  "adrspach":"photo-M11Wp99M33g",                     // Sandsteinfelsen
  // ── IRLAND ───────────────────────────────────────────────────────────────
  "dublin":"photo-1549880181-FxVj5dj1YLs",            // Temple Bar rote Fassade
  "galway":"photo-IZAnYwnPGoE",                       // The Long Walk Häuserreihe
  "cork":"photo-Eu9UxRYJ0es",                         // St. Fin Barre's Cathedral
  "cliffs of moher":"photo-tiKp0cJn-MI",              // Klippenküste
  "moher":"photo-tiKp0cJn-MI",
  "killarney":"photo-y5xEBmxUMT4",                    // Ross Castle Nationalpark
  "kilkenny":"photo-tDBP9xJYDLs",                     // Kilkenny Castle
  "blarney":"photo-1476209452230-8d4ec30e5a14",       // Blarney Castle
  "dingle":"photo-pWmTNJVMbQs",                       // Bunter Hafen Dingle
  "kylemore":"photo-q_nfPiNBKT8",                     // Kloster am See
  "glendalough":"photo-1561037404-61cd46aa615b",      // Rundturm Klosterruine
  // ── BELGIEN ──────────────────────────────────────────────────────────────
  "brussels":"photo-M8HGBlc6Q88",                     // Grand Place
  "brüssel":"photo-M8HGBlc6Q88",
  "bruges":"photo-askXfOGzbUM",                       // Belfried Marktplatz
  "brügge":"photo-askXfOGzbUM",
  "antwerp":"photo-kMbU6CQQKR8",                      // Bahnhof Antwerpen-Centraal
  "antwerpen":"photo-kMbU6CQQKR8",
  "ghent":"photo-eUTm3v_x9TM",                        // Graslei Korenlei Giebelhäuser
  "gent":"photo-eUTm3v_x9TM",
  "ypres":"photo-1567004726-65571f5sA7u",             // Tuchhallen
  "ypern":"photo-1567004726-65571f5sA7u",
  // ── UNGARN ───────────────────────────────────────────────────────────────
  "budapest":"photo-s8khmvGXWo0",                     // Parlamentsgebäude Donau
  "eger":"photo-dOv0a5Sj4S4",                         // Burg von Eger
  "tihany":"photo-F8QBFMnf0RI",                       // Abtei Balaton
  "hallókő":"photo-nFWB881HKCk",                      // Traditionelle Bauernhäuser
  "hollókő":"photo-nFWB881HKCk",
  // ── BALTIKUM ─────────────────────────────────────────────────────────────
  "tallinn":"photo-pEFRGvCmfoY",                      // Historische Skyline Türme
  "riga":"photo-8EzNkvLQosk",                         // Schwarzhäupterhaus
  "vilnius":"photo-6sz7qXOT7FM",                      // Gediminas-Turm
  "trakai":"photo-Xw3T0kYR0W0",                       // Wasserburg Galvė-See
  // ── RUMÄNIEN / BULGARIEN ─────────────────────────────────────────────────
  "bucharest":"photo-1558618047-3c8d088eb09e",        // Parlamentspalast
  "bukarest":"photo-1558618047-3c8d088eb09e",
  "brasov":"photo-7KMec8bfIsQ",                       // Schwarze Kirche
  "brașov":"photo-7KMec8bfIsQ",
  "bran":"photo-1517263904808-5dc91e3e7044",          // Schloss Bran Dracula
  "sibiu":"photo-HSJBb1AH8oU",                        // Häuser mit Augen
  "sofia":"photo-o3rSBLFHvbE",                        // Alexander-Newski-Kathedrale
  "plovdiv":"photo-1550016048-45fc4HCxFSJ",           // Antikes Römisches Theater
  "rila":"photo-1566438296520-cc8f2b3cf7af",          // Rila-Kloster Innenhof
  "rila monastery":"photo-1566438296520-cc8f2b3cf7af",
  // ── MONTENEGRO / ALBANIEN ─────────────────────────────────────────────────
  "kotor":"photo-c93KzC_PxFA",                        // Bucht von Kotor
  "budva":"photo-aSy2Ou4BdE4",                        // Altstadt-Halbinsel
  "perast":"photo-aSy2Ou4BdE4",                       // Barocker Küstenort
  "sveti stefan":"photo-c93KzC_PxFA",                 // Insel-Dorf Adria
  "tirana":"photo-1553603227-2d7d03ac3a14",           // Skanderbeg-Platz
  "berat":"photo-1592394533824-9440e429a9f3",         // Stadt der tausend Fenster
  "gjirokaster":"photo-1592394533824-9440e429a9f3",   // Osmanische Zitadelle
  "gjirokastra":"photo-1592394533824-9440e429a9f3",
  "ksamil":"photo-Dpt0DL26vc4",                       // Inseln türkises Wasser
  // ── ISLAND ───────────────────────────────────────────────────────────────
  "iceland":"photo-1476610182048-b716b8518aae",       // Polarlichter
  "reykjavik":"photo-epZSvQoVLtw",                    // Hallgrímskirkja
  "skogafoss":"photo-Z6JhSpqkWdo",                    // Riesiger Wasserfall
  "skógafoss":"photo-Z6JhSpqkWdo",
  "jokulsarlon":"photo-Y-U2aEY0QDM",                 // Gletscherlagune Eisberge
  "jökulsárlón":"photo-Y-U2aEY0QDM",
  "vik":"photo-1516655855035-d5215f7e1893",           // Schwarzer Sandstrand Reynisfjara
  // ── DÄNEMARK ─────────────────────────────────────────────────────────────
  "copenhagen":"photo-B8LJRm9iiwM",                   // Nyhavn
  "kopenhagen":"photo-B8LJRm9iiwM",
  "aarhus":"photo-FbFLsWTi1tY",                       // ARoS Kunstmuseum Regenbogen
  "odense":"photo-v87ujSfIc_c",                       // H.C. Andersen Museum / Dom
  "skagen":"photo-1500530855697-b586d89ba3ee",        // Grenen Zusammenfluss Meere
  // ── NAHER OSTEN & AFRIKA ─────────────────────────────────────────────────
  "istanbul":"photo-oMjSuVvQ8YQ",                     // Hagia Sophia
  "dubai":"photo-1512453979798-5ea266f8880c",         // Burj Khalifa
  "abu dhabi":"photo-1512453979798-5ea266f8880c",
  "cairo":"photo-rxv2qwYPe6s",                        // Pyramiden von Gizeh
  "marrakech":"photo-1539020140153-e479b8c22e70",     // Medina
  "morocco":"photo-1539020140153-e479b8c22e70",
  "cape town":"photo-tRPvXfu5Xf0",                    // Tafelberg
  // ── ASIEN ────────────────────────────────────────────────────────────────
  "tokyo":"photo-1540959733332-eab4deabeeaf",
  "kyoto":"photo-1528360983277-13d401cdc186",
  "osaka":"photo-1540959733332-eab4deabeeaf",
  "bali":"photo-1537996194471-e657df975ab4",
  "phuket":"photo-xGehJClmaAc",
  "bangkok":"photo-1528181304800-259b08848526",
  "thailand":"photo-1528181304800-259b08848526",
  "chiang mai":"photo-1528181304800-259b08848526",
  "hanoi":"photo-ddkn-BgtbNQ",
  "vietnam":"photo-1507525428034-b723cf961d3e",
  "ho chi minh":"photo-1507525428034-b723cf961d3e",
  "singapore":"photo-1525625293386-3f8f99389edd",
  "hong kong":"photo-V1yCY1lY2-k",
  "seoul":"photo-T5NIVYYfynY",
  "maldives":"photo-1514282401047-d79a71a590e8",
  "new zealand":"photo-1507699622108-4be3abd695ad",
  "sydney":"photo-1506973035872-a4ec16b8e8d9",
  // ── AMERICAS ─────────────────────────────────────────────────────────────
  "new york":"photo-1534430480872-3498386e7856",
  "los angeles":"photo-jnOXw0Nxz2w",
  "miami":"photo-jZ5Zq1P3-Ps",
  "mexico city":"photo-U1SLPzGSzu8",
  "cancun":"photo-xGehJClmaAc",
  "rio":"photo-OkiDIla7K8Q",                          // Christ the Redeemer
  "rio de janeiro":"photo-OkiDIla7K8Q",
  "buenos aires":"photo-KrXHa0JrHt0",                 // Obelisco
};
function heroImg(dest){
  const d=(dest||"").toLowerCase();
  const k=Object.keys(DEST_PHOTO_MAP).find(k=>d.includes(k));
  if(k) return `https://images.unsplash.com/${DEST_PHOTO_MAP[k]}?w=1200&q=85`;
  return null; // signals: needs async lookup
}

// ── Wikipedia landmark photo fallback ─────────────────────────────────────────
// Cache for Wikipedia API results
const _wikiImgCache=new Map();

/** Hook: returns a landmark photo URL for any destination.
 *  Fast-path: DEST_PHOTO_MAP lookup (instant, no network).
 *  Slow-path: Wikipedia REST API — free, no API key, always returns the
 *  city's main article image which is almost always the iconic landmark. */
function useDestImg(dest){
  const mapUrl=React.useMemo(()=>heroImg(dest),[dest]);

  const [wikiUrl,setWikiUrl]=React.useState(()=>{
    const key=(dest||"").toLowerCase().trim();
    return _wikiImgCache.has(key)?_wikiImgCache.get(key):null;
  });

  React.useEffect(()=>{
    if(mapUrl||!dest) return;
    const key=(dest||"").toLowerCase().trim();
    if(_wikiImgCache.has(key)){ setWikiUrl(_wikiImgCache.get(key)); return; }
    fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(dest)}`)
      .then(r=>r.ok?r.json():null)
      .then(data=>{
        let url=data?.thumbnail?.source||null;
        // Replace low-res thumbnail size with a high-res version (1200px wide)
        if(url) url=url.replace(/\/\d+px-/,'/1200px-');
        _wikiImgCache.set(key,url);
        setWikiUrl(url);
      })
      .catch(()=>{ _wikiImgCache.set(key,null); });
  },[dest,mapUrl]);

  // Return: Unsplash map photo > Wikipedia landmark photo > generic fallback
  return mapUrl||wikiUrl||`https://source.unsplash.com/featured/1200x900/?${encodeURIComponent((dest||'')+'  landmark travel')}&sig=${encodeURIComponent(dest||'')}`;
}

/** Div whose backgroundImage is loaded asynchronously from DEST_PHOTO_MAP
 *  (instant) or Wikipedia API (async, ~200ms, zero cost). */
function DestPhotoBg({dest,gradient,style,children}){
  const imgUrl=useDestImg(dest);
  const bg=gradient?`${gradient},url(${imgUrl})`:`url(${imgUrl})`;
  return(
    <div style={{backgroundSize:"cover",backgroundPosition:"center",...style,backgroundImage:bg}}>
      {children}
    </div>
  );
}

function actImg(q){ return picsum((q||"travel").toLowerCase().replace(/\s+/g,"-").slice(0,40),600,400); }

// ── Google Places Activity Photos ──────────────────────────────────────────────
const _photoCache=new Map();
async function _fetchPlacePhoto(query,key){
  if(!key||key==="PASTE_YOUR_KEY_HERE") return null;
  const ck=query.toLowerCase().trim().slice(0,60);
  if(_photoCache.has(ck)) return _photoCache.get(ck);
  _photoCache.set(ck,null); // lock to prevent duplicate fetches
  try{
    const r=await fetch("https://places.googleapis.com/v1/places:searchText",{
      method:"POST",
      headers:{"Content-Type":"application/json","X-Goog-Api-Key":key,"X-Goog-FieldMask":"places.photos"},
      body:JSON.stringify({textQuery:query,maxResultCount:1})
    });
    const d=await r.json();
    const pn=d?.places?.[0]?.photos?.[0]?.name;
    if(pn){
      const url=`https://places.googleapis.com/v1/${pn}/media?maxWidthPx=800&key=${key}`;
      _photoCache.set(ck,url);
      return url;
    }
  }catch(_){}
  return null;
}
function useActivityPhoto(imgQuery,name){
  const fallback=actImg(imgQuery||name);
  const [src,setSrc]=useState(fallback);
  useEffect(()=>{
    let cancelled=false;
    const q=(imgQuery||name||"").trim();
    if(!q) return;
    if(!GOOGLE_PLACES_KEY||GOOGLE_PLACES_KEY==="PASTE_YOUR_KEY_HERE") return;
    const ck=q.toLowerCase().slice(0,60);
    if(_photoCache.has(ck)&&_photoCache.get(ck)){setSrc(_photoCache.get(ck));return;}
    _fetchPlacePhoto(q,GOOGLE_PLACES_KEY).then(url=>{if(!cancelled&&url) setSrc(url);});
    return()=>{cancelled=true;};
  },[imgQuery,name]);
  return [src,()=>setSrc(fallback)];
}

function typeEmoji(t){
  if(!t) return "📍"; const s=t.toLowerCase();
  if(s.includes("museum")||s.includes("gallery")) return "🏛️";
  if(s.includes("nightclub")||s.includes("club")) return "🎉";
  if(s.includes("bar")||s.includes("pub")||s.includes("cocktail")) return "🍸";
  if(s.includes("park")||s.includes("garden")||s.includes("nature")) return "🌳";
  if(s.includes("beach")) return "🏖️";
  if(s.includes("restaurant")||s.includes("dining")) return "🍽️";
  if(s.includes("cafe")||s.includes("bistro")) return "☕";
  if(s.includes("castle")||s.includes("palace")) return "🏰";
  if(s.includes("church")||s.includes("cathedral")) return "⛪";
  if(s.includes("market")) return "🛍️";
  if(s.includes("viewpoint")||s.includes("view")) return "🌄";
  return "📍";
}
function getDays(s,e){ if(!s||!e) return 0; return Math.max(1,Math.round((new Date(e)-new Date(s))/86400000)+1); }
function fmtDate(d){ if(!d) return ""; return new Date(d+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}); }
function uid(){ return "_"+Math.random().toString(36).slice(2,9); }
function toMins(t){ if(!t) return null; const p=(t+"").split(":").map(Number); return isNaN(p[0])?null:p[0]*60+(p[1]||0); }
function fmtTime(m){ if(m==null) return ""; return String(Math.floor(m/60)).padStart(2,"0")+":"+String(m%60).padStart(2,"0"); }
function parseEuro(price){
  if(!price) return 0;
  const s=String(price).replace(",",".").toLowerCase();
  if(s.includes("free")) return 0;
  const match=s.match(/(\d+(\.\d+)?)/);
  return match?Number(match[1]):0;
}
function parseDurationToMinutes(duration){
  if(!duration) return 90;
  const s=String(duration).toLowerCase();
  const h=s.match(/(\d+)\s*h/); const m=s.match(/(\d+)\s*m/);
  let mins=0;
  if(h) mins+=Number(h[1])*60;
  if(m) mins+=Number(m[1]);
  if(!mins){ if(s.includes("half day")) return 240; if(s.includes("full day")) return 480; return 90; }
  return mins;
}
function isOutdoorActivity(act){
  const t=`${act?.type||""} ${act?.name||""} ${act?.desc||""}`.toLowerCase();
  return ["park","garden","beach","viewpoint","hike","walking","nature","market","photography","architecture","boat","outdoor"].some(k=>t.includes(k));
}
function isIndoorActivity(act){
  const t=`${act?.type||""} ${act?.name||""} ${act?.desc||""}`.toLowerCase();
  return ["museum","gallery","cafe","restaurant","spa","shopping","mall","cathedral","church","cinema","theater","indoor"].some(k=>t.includes(k));
}
function isDining(act){
  const t=`${act?.type||""} ${act?.name||""}`.toLowerCase();
  return ["restaurant","dining","bistro","brasserie","cafe","bar","cocktail"].some(k=>t.includes(k));
}
function weatherLooksRainy(wf){ return ["rain","storm","shower","thunder"].some(k=>String(wf||"").toLowerCase().includes(k)); }
function weatherLooksHot(wf){ const m=String(wf||"").match(/(-?\d+)/); const t=m?Number(m[1]):null; return t!=null&&t>=28; }
function computeDayBudget(day){
  const acts=(day.activities||[]).reduce((s,a)=>s+parseEuro(a.price),0);
  return{activities:acts,lunch:parseEuro(day.lunch?.price),dinner:parseEuro(day.dinner?.price),total:acts+parseEuro(day.lunch?.price)+parseEuro(day.dinner?.price)};
}
function computeTripBudget(days){
  return days.reduce((acc,day)=>{const d=computeDayBudget(day);acc.activities+=d.activities;acc.lunch+=d.lunch;acc.dinner+=d.dinner;acc.total+=d.total;return acc;},{activities:0,lunch:0,dinner:0,total:0});
}
function museumLike(act){ const t=`${act?.type||""} ${act?.name||""}`.toLowerCase(); return ["museum","gallery","cathedral","church","palace","castle"].some(k=>t.includes(k)); }
function viewpointLike(act){ const t=`${act?.type||""} ${act?.name||""}`.toLowerCase(); return ["viewpoint","rooftop","sunset","tower","lookout"].some(k=>t.includes(k)); }
function nightlifeLike(act){ const t=`${act?.type||""} ${act?.name||""}`.toLowerCase(); return ["bar","club","nightlife","cocktail","pub","live music"].some(k=>t.includes(k)); }
function scoreActivity(act,context){
  let score=0;
  const outdoor=isOutdoorActivity(act),indoor=isIndoorActivity(act),dining=isDining(act);
  if(context.isRainy){ if(indoor) score+=30; if(outdoor) score-=35; }
  if(context.isHot){ if(indoor) score+=12; if(outdoor) score-=8; }
  if(context.period==="morning"){ if(dining) score-=8; if(outdoor) score+=6; }
  if(context.period==="midday"){ if(dining) score+=18; if(indoor) score+=8; }
  if(context.period==="afternoon"){ if(museumLike(act)) score+=10; if(viewpointLike(act)) score+=6; }
  if(context.period==="evening"){ if(dining) score+=20; if(nightlifeLike(act)) score+=25; if(museumLike(act)) score-=10; }
  if(act.locked) score+=1000;
  return score;
}
function getDayStart(day,form){
  if(day?.day===1&&form?.arrivalTime){const a=toMins(form.arrivalTime);if(a!=null)return Math.min(a+60,18*60);}
  return 9*60;
}
function getDayEnd(day,form,totalDays){
  if(day?.day===totalDays&&form?.departureTime){const d=toMins(form.departureTime);if(d!=null)return Math.max(d-120,10*60);}
  return 22*60;
}
function getTimeBlocks(dayStart,dayEnd){
  const blocks=[];
  const morningStart=dayStart,middayStart=Math.max(dayStart,12*60),afternoonStart=Math.max(dayStart,15*60),eveningStart=Math.max(dayStart,19*60);
  if(morningStart<Math.min(dayEnd,12*60)) blocks.push({label:"morning",start:morningStart});
  if(middayStart<Math.min(dayEnd,15*60)) blocks.push({label:"midday",start:middayStart});
  if(afternoonStart<Math.min(dayEnd,19*60)) blocks.push({label:"afternoon",start:afternoonStart});
  if(eveningStart<dayEnd) blocks.push({label:"evening",start:eveningStart});
  return blocks;
}
function normalizeActivity(act,idx){
  const durationMins=parseDurationToMinutes(act.duration);
  const explicitStart=toMins(act.time);
  return{...act,_engine:{originalIndex:idx,durationMins,explicitStart,outdoor:isOutdoorActivity(act),indoor:isIndoorActivity(act),dining:isDining(act)}};
}
function stableSortByScore(list,getScore){
  return [...list].map((item,index)=>({item,index,score:getScore(item)})).sort((a,b)=>b.score!==a.score?b.score-a.score:a.index-b.index).map(x=>x.item);
}
function assignTimes(activities,dayStart,dayEnd){
  let cursor=dayStart;
  return activities.map(act=>{
    const dur=act._engine.durationMins;
    const start=act.locked&&act._engine.explicitStart!=null?Math.max(act._engine.explicitStart,cursor):cursor;
    const end=start+dur;
    cursor=end+20;
    return{...act,time:fmtTime(start),endTime:fmtTime(end),conflict:end>dayEnd,_engine:{...act._engine,start,end}};
  });
}
function prioritizeActivities(activities,weatherForecast,dayStart,dayEnd){
  const isRainy=weatherLooksRainy(weatherForecast),isHot=weatherLooksHot(weatherForecast);
  const locked=activities.filter(a=>a.locked),flexible=activities.filter(a=>!a.locked);
  const blocks=getTimeBlocks(dayStart,dayEnd);
  if(!blocks.length) return [...locked,...flexible];
  const used=new Set(),selected=[];
  for(const block of blocks){
    const candidates=flexible.filter(a=>!used.has(a._engine.originalIndex));
    if(!candidates.length) continue;
    const best=stableSortByScore(candidates,act=>scoreActivity(act,{isRainy,isHot,period:block.label}))[0];
    if(best){used.add(best._engine.originalIndex);selected.push(best);}
  }
  const remaining=flexible.filter(a=>!used.has(a._engine.originalIndex));
  const rankedRemaining=stableSortByScore(remaining,act=>scoreActivity(act,{isRainy,isHot,period:"afternoon"}));
  return [...locked,...selected,...rankedRemaining];
}
function buildAlternativePlan(day,mode){
  const acts=[...(day.activities||[])];
  if(mode==="budget") return{...day,altMode:"budget",activities:acts.map(a=>parseEuro(a.price)<=20?a:{...a,alternativeFlag:true,desc:`${a.desc||""} Budget-friendly alternative recommended.`})};
  if(mode==="relaxed") return{...day,altMode:"relaxed",activities:acts.slice(0,Math.max(1,acts.length-1))};
  if(mode==="fast") return{...day,altMode:"fast",activities:acts.map(a=>({...a,duration:"1h"}))};
  if(mode==="rainy") return{...day,altMode:"rainy",activities:[...acts].sort((a,b)=>(isOutdoorActivity(a)?1:0)-(isOutdoorActivity(b)?1:0))};
  return day;
}
function buildTripText(data,form,days){
  const l=[];
  l.push("TripMind AI"); l.push(data.destination); l.push("");
  l.push(`Travelers: ${form.travelers||"-"}`); l.push(`Style: ${form.style||"-"}`); l.push(`Transport: ${form.transport||"-"}`); l.push("");
  for(const day of days){
    l.push(`DAY ${day.day}: ${day.theme||""}`);
    if(day.neighborhood) l.push(`Area: ${day.neighborhood}`);
    if(day.weatherForecast) l.push(`Weather: ${day.weatherForecast}`);
    l.push("");
    for(const act of day.activities||[]){
      l.push(`- ${act.time||"--:--"} ${act.name} (${act.type||"Activity"})`);
      if(act.address) l.push(`  ${act.address}`);
      if(act.price) l.push(`  Price: ${act.price}`);
    }
    if(day.lunch?.name) l.push(`Lunch: ${day.lunch.name} (${day.lunch.price||""})`);
    if(day.dinner?.name) l.push(`Dinner: ${day.dinner.name} (${day.dinner.price||""})`);
    l.push("");
  }
  return l.join("\n");
}
function downloadTextFile(filename,content){
  const blob=new Blob([content],{type:"text/plain;charset=utf-8"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a"); a.href=url; a.download=filename; a.click();
  URL.revokeObjectURL(url);
}
function exportTripAsPrintableHTML(data,form,days){
  const html=`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>TripMind - ${data.destination}</title>
<style>body{font-family:Arial,sans-serif;padding:32px;color:#222}h1{margin-bottom:4px}.muted{color:#666;margin-bottom:20px}.day{margin:28px 0;padding-bottom:16px;border-bottom:1px solid #ddd}.act{margin:8px 0;padding:8px 0}</style></head>
<body><h1>${data.destination}</h1>
<div class="muted">Travelers: ${form.travelers||"-"} · Style: ${form.style||"-"} · Transport: ${form.transport||"-"}</div>
${days.map(day=>`<div class="day"><h2>Day ${day.day}: ${day.theme||""}</h2><div>${day.weatherForecast||""}</div>${(day.activities||[]).map(act=>`<div class="act"><strong>${act.time||"--:--"} - ${act.name}</strong><br/>${act.type||""}<br/>${act.address||""}<br/>${act.price||""}</div>`).join("")}</div>`).join("")}
<script>window.onload=()=>window.print();</script></body></html>`;
  const win=window.open("","_blank"); win.document.write(html); win.document.close();
}
async function shareTripText(data,form,days){
  const text=buildTripText(data,form,days);
  if(navigator.share){ await navigator.share({title:`TripMind - ${data.destination}`,text}); return; }
  await navigator.clipboard.writeText(text);
  alert(t(getLang(),"tripCopied"));
}
function weatherStyle(f){
  const m=(f||"").match(/(-?\d+)/); const t=m?parseInt(m[1]):null;
  if(t===null) return {bg:"var(--tm-border)",bd:"var(--tm-border)",c:"#555"};
  if(t>=20)    return {bg:"var(--tm-surface)",bd:"var(--tm-border)",c:"#111"};
  if(t>=10)    return {bg:"var(--tm-border)",bd:"#555",c:"#111"};
  return {bg:"var(--tm-border)",bd:"var(--tm-border)",c:"#555"};
}

const CSS=[
  "@keyframes spin{to{transform:rotate(360deg)}}",
  "@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}",
  "@keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}",
  "@keyframes landingIn{from{opacity:0;transform:translateY(28px)}to{opacity:1;transform:translateY(0)}}",
  "@keyframes landingFade{from{opacity:0}to{opacity:1}}",
  "@keyframes subtitleIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}",
  "@keyframes ctaIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}",
  ".landing-title{animation:landingIn .9s cubic-bezier(.22,1,.36,1) .35s both}",
  ".landing-sub{animation:subtitleIn .8s cubic-bezier(.22,1,.36,1) .65s both}",
  ".landing-cta{animation:ctaIn .7s cubic-bezier(.22,1,.36,1) .9s both}",
  ".landing-logo{animation:landingFade .8s ease .1s both}",
  ".landing-badge{animation:landingFade .8s ease 1.3s both}",
  ".fu{animation:fadeUp .25s ease forwards}",
  "*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}",
  "body{background:#F5EFEB;-webkit-text-size-adjust:100%;font-family:\"FF Real\",\"FF Real Text\",\"FF Real Head\",\"DM Sans\",system-ui,sans-serif;overflow-x:hidden}",
  "input,textarea,select,button{font-family:\"FF Real\",\"FF Real Text\",\"FF Real Head\",\"DM Sans\",system-ui,sans-serif;font-size:16px}",
  "input,textarea,select{font-size:16px!important}",
  "input:focus,textarea:focus,select:focus{outline:2px solid #555;outline-offset:1px}",
  "a{text-decoration:none}",
  "button{cursor:pointer;touch-action:manipulation}",
  "button:active{opacity:.72}",
  ".sx{display:flex;overflow-x:auto;-webkit-overflow-scrolling:touch}",
  ".sx::-webkit-scrollbar{display:none}",
  ".leaflet-container{font-family:\"FF Real\",\"FF Real Text\",\"DM Sans\",system-ui,sans-serif}",
].join("\n");

// ── Primitives ─────────────────────────────────────────────────────────────────
const Lbl=({c,sub})=><div className="tm-section-title" style={{color:sub?"#8A9CAA":undefined}}>{c}</div>;
const TIn=({value,onChange,placeholder,type,style})=><input type={type||"text"} value={value} onChange={onChange} placeholder={placeholder} style={{width:"100%",padding:"12px 13px",background:"var(--tm-surface2)",border:"1.5px solid var(--tm-border)",borderRadius:9,color:"var(--tm-text)",fontFamily:"inherit",...(style||{})}}/>;
const Chip=({label,on,onClick})=><button onClick={onClick} style={{padding:"9px 14px",minHeight:38,borderRadius:50,fontSize:".8rem",fontFamily:"inherit",background:on?"#111":"var(--tm-border)",border:"1.5px solid "+(on?"var(--tm-text)":"var(--tm-border)"),color:on?"#fff":"var(--tm-text)",whiteSpace:"nowrap"}}>{label}</button>;
const Crd=({children,style})=><div style={{background:"var(--tm-bg)",border:"1px solid var(--tm-border)",borderRadius:14,padding:18,marginBottom:13,...(style||{})}}>{children}</div>;
const Spin=({size})=><div style={{width:size||22,height:size||22,border:"2.5px solid var(--tm-border)",borderTop:"2.5px solid #555",borderRadius:"50%",animation:"spin .7s linear infinite",display:"inline-block",flexShrink:0}}/>;
const Btn=({children,onClick,color,disabled,full,outline})=>{
  const bg=disabled?"var(--tm-border)":outline?"#fff":(color||"#111");
  const cl=disabled?"#8A9CAA":outline?(color||"#111"):"#fff";
  return <button onClick={disabled?null:onClick} style={{padding:"13px 20px",minHeight:50,borderRadius:12,fontSize:".95rem",fontWeight:800,fontFamily:"inherit",border:outline?"1.5px solid "+(color||"#111"):"none",background:bg,color:cl,width:full?"100%":"auto"}}>{children}</button>;
};

// ── Landing Page ───────────────────────────────────────────────────────────────
// ── Password hashing via Web Crypto (PBKDF2) — no server needed ───────────────
async function hashPw(password){
  const enc=new TextEncoder();
  const key=await crypto.subtle.importKey("raw",enc.encode(password),{name:"PBKDF2"},false,["deriveBits"]);
  const salt=enc.encode("tripmind-salt-v1");
  const bits=await crypto.subtle.deriveBits({name:"PBKDF2",salt,iterations:100000,hash:"SHA-256"},key,256);
  return Array.from(new Uint8Array(bits)).map(b=>b.toString(16).padStart(2,"0")).join("");
}
async function verifyPw(password,storedHash){
  return (await hashPw(password))===storedHash;
}

function LandingScreen({onEnter}){
  const [leaving,setLeaving]=useState(false);
  const [step,setStep]=useState("home");
  const [email,setEmail]=useState("");
  const [pass,setPass]=useState("");
  const [pass2,setPass2]=useState("");
  const [userName,setUserName]=useState("");
  const [code,setCode]=useState("");
  const [signupToken,setSignupToken]=useState("");
  const [loading,setLoading]=useState(false);
  const [err,setErr]=useState("");
  const [devCode,setDevCode]=useState("");
  const lang=getLang();
  const T=(k)=>t(lang,k);

  const BG="url(https://images.unsplash.com/photo-1551632811-561732d1e306?w=1800&q=85)";

  function enter(){ setLeaving(true); setTimeout(onEnter,700); }
  function goStep(s){ setErr(""); setStep(s); }

  async function doLogin(e){
    e.preventDefault(); setErr(""); setLoading(true);
    try{
      const users=JSON.parse(localStorage.getItem("tm_users")||"[]");
      const user=users.find(u=>u.email===email.trim().toLowerCase());
      if(!user){ setErr(T("noAccountFound")); setLoading(false); return; }
      const ok=await verifyPw(pass,user.passwordHash);
      if(!ok){ setErr(T("wrongPassword")); setLoading(false); return; }
      localStorage.setItem("tm_session",JSON.stringify({email:user.email,name:user.name}));
      try{ const p=JSON.parse(localStorage.getItem("tm_profile")||"{}"); if(!p.name) localStorage.setItem("tm_profile",JSON.stringify({...p,name:user.name})); }catch(_){}
      enter();
    }catch(_){ setErr(T("somethingWrong")); }
    setLoading(false);
  }

  async function doSignupEmail(e){
    e.preventDefault();
    if(!email.includes("@")){ setErr(T("enterValidEmail")); return; }
    setErr(""); setLoading(true);
    try{
      const r=await fetch("/api/auth/signup-start",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:email.trim().toLowerCase()})});
      const d=await r.json();
      if(!r.ok){ setErr(d.error||T("couldNotSend")); setLoading(false); return; }
      setSignupToken(d.token);
      if(d._devCode) setDevCode(d._devCode);
      goStep("signup-code");
    }catch(_){ setErr(T("networkError")); }
    setLoading(false);
  }

  async function doVerifyCode(e){
    e.preventDefault();
    if(code.length!==6){ setErr(T("enterCode")); return; }
    setErr(""); setLoading(true);
    try{
      const r=await fetch("/api/auth/signup-verify",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token:signupToken,code:code.trim()})});
      const d=await r.json();
      if(!r.ok||!d.valid){ setErr(d.error||T("wrongCode")); setLoading(false); return; }
      goStep("signup-pass");
    }catch(_){ setErr(T("networkError")); }
    setLoading(false);
  }

  async function doCreateAccount(e){
    e.preventDefault();
    if(!userName.trim()){ setErr(T("enterName")); return; }
    if(pass.length<8){ setErr(T("passMinLength")); return; }
    if(pass!==pass2){ setErr(T("passNoMatch")); return; }
    setErr(""); setLoading(true);
    try{
      const passwordHash=await hashPw(pass);
      const users=JSON.parse(localStorage.getItem("tm_users")||"[]");
      const em=email.trim().toLowerCase();
      const newUser={email:em,name:userName.trim(),passwordHash,createdAt:Date.now()};
      localStorage.setItem("tm_users",JSON.stringify([...users.filter(u=>u.email!==em),newUser]));
      localStorage.setItem("tm_session",JSON.stringify({email:em,name:userName.trim()}));
      try{ const p=JSON.parse(localStorage.getItem("tm_profile")||"{}"); localStorage.setItem("tm_profile",JSON.stringify({...p,name:userName.trim()})); }catch(_){}
      enter();
    }catch(_){ setErr(T("couldNotCreate")); }
    setLoading(false);
  }

  const INP={width:"100%",padding:"13px 15px",borderRadius:12,background:"rgba(255,255,255,.14)",border:"1.5px solid rgba(255,255,255,.25)",color:"#fff",fontSize:".95rem",fontFamily:"inherit",outline:"none",marginBottom:10};
  const BTN_PRI={width:"100%",padding:"15px",borderRadius:14,marginTop:4,background:"var(--tm-bg)",border:"none",color:"#1a2a1a",fontWeight:800,fontSize:"1rem",fontFamily:"inherit",cursor:"pointer",boxShadow:"0 4px 20px rgba(0,0,0,.25)",opacity:loading?.6:1};
  const BACK={background:"none",border:"none",color:"rgba(255,255,255,.5)",fontSize:".8rem",fontFamily:"inherit",cursor:"pointer",marginTop:12,display:"block",width:"100%",textAlign:"center",padding:"6px 0"};
  const LABEL={fontSize:".72rem",fontWeight:700,letterSpacing:".06em",textTransform:"uppercase",color:"rgba(255,255,255,.5)",marginBottom:6,display:"block"};

  return(
    <div style={{position:"fixed",inset:0,zIndex:9999,overflow:"hidden",background:"#0d1a0d",transition:"opacity .7s cubic-bezier(.4,0,.2,1)",opacity:leaving?0:1,pointerEvents:leaving?"none":"auto"}}>
      <style>{CSS}</style>
      <div style={{position:"absolute",inset:0,backgroundImage:BG,backgroundSize:"cover",backgroundPosition:"center 30%"}}/>
      <div style={{position:"absolute",inset:0,background:"linear-gradient(to bottom,rgba(0,0,0,.15) 0%,rgba(0,0,0,.1) 35%,rgba(0,0,0,.65) 65%,rgba(0,0,0,.88) 100%)"}}/>

      {/* Logo */}
      <div className="landing-logo" style={{position:"absolute",top:0,left:0,right:0,zIndex:2,display:"flex",alignItems:"center",justifyContent:"center",padding:"40px 32px 0"}}>
        <div style={{fontWeight:900,fontSize:"1.05rem",letterSpacing:".22em",color:"#fff",textTransform:"uppercase",textShadow:"0 2px 12px rgba(0,0,0,.5)"}}>TripMind</div>
      </div>

      {/* Slogan */}
      <div style={{position:"absolute",inset:0,zIndex:2,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"0 32px",paddingBottom:step==="home"?"210px":"320px",transition:"padding-bottom .45s cubic-bezier(.4,0,.2,1)"}}>
        {step==="home"&&(
          <div className="landing-title" style={{fontSize:"clamp(2.4rem,10vw,4rem)",fontWeight:900,color:"#fff",lineHeight:1.08,letterSpacing:"-.035em",textAlign:"center",textShadow:"0 4px 32px rgba(0,0,0,.45),0 1px 4px rgba(0,0,0,.6)"}}>
            Travel smarter.<br/>Live deeper.
          </div>
        )}
      </div>

      {/* Auth card */}
      <div className="landing-cta" style={{position:"absolute",bottom:0,left:0,right:0,zIndex:2,padding:"0 18px 34px"}}>
        <div style={{background:"rgba(14,20,14,.75)",backdropFilter:"blur(28px)",WebkitBackdropFilter:"blur(28px)",border:"1px solid rgba(255,255,255,.16)",borderRadius:24,padding:"24px 20px 20px",maxWidth:460,margin:"0 auto"}}>

          {step==="home"&&(
            <>
              <div style={{fontSize:".74rem",fontWeight:600,color:"rgba(255,255,255,.5)",textAlign:"center",letterSpacing:".07em",textTransform:"uppercase",marginBottom:16}}>{T("nextAdventure")}</div>
              <div style={{display:"flex",gap:10,marginBottom:12}}>
                <button onClick={()=>goStep("login")} style={{flex:1,padding:"15px 10px",borderRadius:14,background:"rgba(255,255,255,.15)",border:"1.5px solid rgba(255,255,255,.26)",color:"#fff",fontWeight:700,fontSize:".95rem",fontFamily:"inherit",cursor:"pointer"}}>{T("logIn")}</button>
                <button onClick={()=>goStep("signup-email")} style={{flex:1,padding:"15px 10px",borderRadius:14,background:"var(--tm-bg)",border:"none",color:"#1a2a1a",fontWeight:800,fontSize:".95rem",fontFamily:"inherit",cursor:"pointer",boxShadow:"0 4px 20px rgba(0,0,0,.3)"}}>{T("signUpFree")}</button>
              </div>
              <div style={{textAlign:"center",fontSize:".68rem",color:"rgba(255,255,255,.28)",letterSpacing:".02em"}}>{T("noCreditCard")}</div>
            </>
          )}

          {step==="login"&&(
            <form onSubmit={doLogin}>
              <div style={{fontWeight:800,fontSize:"1.05rem",color:"#fff",marginBottom:18,textAlign:"center"}}>{T("welcomeBack")}</div>
              <label style={LABEL}>{T("email")}</label>
              <input style={INP} type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder={T("emailPlaceholder")} required autoComplete="email"/>
              <label style={LABEL}>{T("password")}</label>
              <input style={INP} type="password" value={pass} onChange={e=>setPass(e.target.value)} placeholder={T("passwordPlaceholder")} required autoComplete="current-password"/>
              {err&&<div className="tm-base tm-mb8 tm-text-center" style={{color:"#fca5a5"}}>{err}</div>}
              <button type="submit" style={BTN_PRI} disabled={loading}>{loading?T("signingIn"):T("logIn")}</button>
              <button type="button" style={BACK} onClick={()=>goStep("home")}>{T("back")}</button>
            </form>
          )}

          {step==="signup-email"&&(
            <form onSubmit={doSignupEmail}>
              <div style={{fontWeight:800,fontSize:"1.05rem",color:"#fff",marginBottom:6,textAlign:"center"}}>{T("createAccount")}</div>
              <div style={{fontSize:".8rem",color:"rgba(255,255,255,.45)",textAlign:"center",marginBottom:18}}>{T("verifyEmailSub")}</div>
              <label style={LABEL}>{T("emailAddress")}</label>
              <input style={INP} type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder={T("emailPlaceholder")} required autoComplete="email"/>
              {err&&<div className="tm-base tm-mb8 tm-text-center" style={{color:"#fca5a5"}}>{err}</div>}
              <button type="submit" style={BTN_PRI} disabled={loading}>{loading?T("sendingCode"):T("sendCode")}</button>
              <button type="button" style={BACK} onClick={()=>goStep("home")}>{T("back")}</button>
            </form>
          )}

          {step==="signup-code"&&(
            <form onSubmit={doVerifyCode}>
              <div style={{fontWeight:800,fontSize:"1.05rem",color:"#fff",marginBottom:6,textAlign:"center"}}>{T("checkEmail")}</div>
              <div style={{fontSize:".8rem",color:"rgba(255,255,255,.45)",textAlign:"center",marginBottom:16}}>{T("codeSentTo")}<br/><span style={{color:"rgba(255,255,255,.8)",fontWeight:700}}>{email}</span></div>
              {devCode&&<div style={{background:"rgba(255,255,170,.1)",border:"1px solid rgba(255,255,100,.28)",borderRadius:10,padding:"10px 14px",marginBottom:12,textAlign:"center",fontSize:".8rem",color:"rgba(255,255,180,.85)"}}>{T("devModeCode")}<br/>Code: <strong style={{letterSpacing:4}}>{devCode}</strong></div>}
              <label style={LABEL}>{T("verificationCode")}</label>
              <input style={{...INP,textAlign:"center",fontSize:"1.6rem",fontWeight:900,letterSpacing:"10px",padding:"14px"}} type="text" inputMode="numeric" maxLength={6} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,""))} placeholder="——————" autoComplete="one-time-code"/>
              {err&&<div className="tm-base tm-mb8 tm-text-center" style={{color:"#fca5a5"}}>{err}</div>}
              <button type="submit" style={{...BTN_PRI,opacity:(loading||code.length!==6)?.5:1}} disabled={loading||code.length!==6}>{loading?T("verifying"):T("verifyCode")}</button>
              <button type="button" style={BACK} onClick={()=>{setCode("");setDevCode("");goStep("signup-email");}}>{T("resendCode")}</button>
            </form>
          )}

          {step==="signup-pass"&&(
            <form onSubmit={doCreateAccount}>
              <div style={{fontWeight:800,fontSize:"1.05rem",color:"#fff",marginBottom:6,textAlign:"center"}}>{T("almostThere")}</div>
              <div style={{fontSize:".8rem",color:"rgba(255,255,255,.45)",textAlign:"center",marginBottom:18}}>{T("setNamePass")}</div>
              <label style={LABEL}>{T("yourName")}</label>
              <input style={INP} type="text" value={userName} onChange={e=>setUserName(e.target.value)} placeholder={T("firstName")} required autoComplete="name"/>
              <label style={LABEL}>{T("password")}</label>
              <input style={INP} type="password" value={pass} onChange={e=>setPass(e.target.value)} placeholder={T("minChars")} required autoComplete="new-password"/>
              <label style={LABEL}>{T("repeatPassword")}</label>
              <input style={INP} type="password" value={pass2} onChange={e=>setPass2(e.target.value)} placeholder={T("repeatPassword")} required autoComplete="new-password"/>
              {err&&<div className="tm-base tm-mb8 tm-text-center" style={{color:"#fca5a5"}}>{err}</div>}
              <button type="submit" style={BTN_PRI} disabled={loading}>{loading?T("creatingAccount"):T("createAccountBtn")}</button>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}

// ── Notification setup card (shown in Setup before generate button) ────────────
function NotifSetupCard(){
  const lang=getLang();
  const T=(k)=>t(lang,k);
  const [status,setStatus]=useState(()=>{
    try{ return localStorage.getItem("tm_notif")==="1"?"granted":Notification?.permission||"default"; }catch(_){ return "default"; }
  });
  const [loading,setLoading]=useState(false);

  async function request(){
    if(!("Notification" in window)){ alert(T("notifUnsupported")); return; }
    setLoading(true);
    if("serviceWorker" in navigator){
      try{ await navigator.serviceWorker.register("/sw.js"); }catch(_){}
    }
    const perm=await Notification.requestPermission();
    setLoading(false);
    setStatus(perm);
    try{ localStorage.setItem("tm_notif",perm==="granted"?"1":"0"); }catch(_){}
  }

  if(status==="granted") return(
    <div style={{display:"flex",alignItems:"center",gap:10,padding:"12px 14px",background:"#f0fdf4",border:"1.5px solid #bbf7d0",borderRadius:12,marginBottom:12}}>
      <span style={{fontSize:"1.2rem"}}>🔔</span>
      <div style={{flex:1}}>
        <div style={{fontWeight:700,fontSize:".86rem",color:"#166534"}}>{T("notifActive")}</div>
        <div style={{fontSize:".74rem",color:"#4ade80",marginTop:1}}>{T("notifActiveSub")}</div>
      </div>
      <span style={{fontSize:".8rem",fontWeight:800,color:"#16a34a"}}>✓</span>
    </div>
  );

  if(status==="denied") return(
    <div style={{padding:"12px 14px",background:"#fef2f2",border:"1.5px solid #fecaca",borderRadius:12,marginBottom:12,fontSize:".8rem",color:"#dc2626"}}>
      {T("notifBlocked")}
    </div>
  );

  return(
    <div style={{display:"flex",alignItems:"center",gap:10,padding:"12px 14px",background:"var(--tm-bg)",border:"1.5px solid var(--tm-border)",borderRadius:12,marginBottom:12}}>
      <span style={{fontSize:"1.2rem"}}>🔔</span>
      <div style={{flex:1}}>
        <div style={{fontWeight:700,fontSize:".86rem",color:"var(--tm-text)"}}>{T("notifReminder")}</div>
        <div style={{fontSize:".74rem",color:"var(--tm-text3)",marginTop:1}}>{T("notifReminderSub")}</div>
      </div>
      <button onClick={request} disabled={loading} style={{flexShrink:0,padding:"7px 13px",borderRadius:9,border:"none",background:"#111",color:"#fff",fontWeight:700,fontFamily:"inherit",fontSize:".78rem",cursor:"pointer",opacity:loading?.6:1}}>
        {loading?"…":T("notifAllow")}
      </button>
    </div>
  );
}

// ── JSON repair ────────────────────────────────────────────────────────────────
function repairJSON(raw){
  // Strip markdown fences
  let s=raw.replace(/```json\s*/gi,"").replace(/```\s*/g,"").trim();
  // Find outermost { }
  const si=s.indexOf("{");
  if(si===-1) throw new Error("No JSON object in response");
  s=s.slice(si);
  // Build cleaned string char-by-char
  let r="",inStr=false,esc=false;
  for(let i=0;i<s.length;i++){
    const c=s[i];
    if(esc){
      // pass through valid escapes; drop invalid ones
      const valid='"\\\/bfnrtu'.includes(c);
      r+=valid?"\\"+c:c;
      esc=false; continue;
    }
    if(c==="\\"){esc=true;continue;}
    if(c==='"'){inStr=!inStr;r+=c;continue;}
    if(inStr){
      // sanitise control chars inside strings
      if(c==="\n"){r+=" ";continue;}
      if(c==="\r"||c==="\t"){continue;}
      if(c.charCodeAt(0)<32){continue;}
      // replace smart quotes/apostrophes with plain equivalents
      if(c==="\u2019"||c==="\u2018"){r+="'";continue;}
      if(c==="\u201c"||c==="\u201d"){r+='"';continue;}
      r+=c;
    } else {
      r+=c;
    }
  }
  // Try parsing as-is
  try{ return JSON.parse(r); }catch(_){
    // Count unclosed brackets and close them
    let op=0,ap=0,in2=false,es=false;
    for(const c of r){
      if(es){es=false;continue;}
      if(c==="\\"){es=true;continue;}
      if(c==='"'){in2=!in2;continue;}
      if(!in2){
        if(c==="{")op++;
        else if(c==="}")op--;
        else if(c==="[")ap++;
        else if(c==="]")ap--;
      }
    }
    let fx=r;
    // If we're mid-string, close it
    if(in2) fx+='"';
    for(let a=0;a<ap;a++) fx+="]";
    for(let b=0;b<op;b++) fx+="}";
    try{ return JSON.parse(fx); }
    catch(e){ throw new Error("Parse failed: "+e.message); }
  }
}

// ── AI call — proxied through local server.py (key stays server-side) ─────────
function getApiKey(){ try{ return localStorage.getItem("tm_api_key")||""; }catch(_){ return ""; } }
async function callAI(prompt,maxTok,attempt){
  attempt=attempt||0;
  try{
    // Always use backend proxy — API key is stored securely on the server
    const url="/api/messages";
    const headers={"Content-Type":"application/json"};
    const res=await fetch(url,{method:"POST",headers,
      body:JSON.stringify({model:MODEL,max_tokens:maxTok||900,messages:[{role:"user",content:prompt}]})});
    if(!res.ok){
      const t=await res.text().catch(()=>"");
      if((res.status===529||res.status>=500)&&attempt<2){await new Promise(r=>setTimeout(r,2000*(attempt+1)));return callAI(prompt,maxTok,attempt+1);}
      throw new Error("API "+res.status+(t?": "+t.slice(0,120):""));
    }
    const data=await res.json();
    if(data.error) throw new Error(data.error.message||"AI error");
    const raw=(data.content||[]).map(b=>b.text||"").join("");
    if(!raw.trim()) throw new Error("Empty response");
    return repairJSON(raw);
  }catch(err){
    if((err.name==="TypeError"||/fetch|network/i.test(err.message))&&attempt<2){
      await new Promise(r=>setTimeout(r,1500*(attempt+1)));
      return callAI(prompt,maxTok,attempt+1);
    }
    throw err;
  }
}

// ── Hidden Gems Engine ────────────────────────────────────────────────────────
function gemTextOf(p){ return[p?.name||"",p?.type||"",p?.desc||"",p?.address||"",p?.editorialSummary||""].join(" ").toLowerCase(); }
function hasAny(text,arr){ return arr.some(x=>text.includes(x)); }
function parsePriceLevel(priceText){
  const s=String(priceText||"").toLowerCase();
  if(!s) return 0;
  if(s.includes("free")) return 0;
  if(s.includes("cheap")||s.includes("budget")) return 1;
  if(s.includes("moderate")) return 2;
  if(s.includes("expensive")) return 3;
  if(s.includes("luxury")) return 4;
  const euros=s.match(/€/g);
  if(euros?.length) return Math.min(euros.length,4);
  return 2;
}
function _gemIsIndoor(p){ return hasAny(gemTextOf(p),["museum","gallery","bookstore","cafe","coffee","restaurant","bistro","workshop","market hall","cathedral","church","cinema","spa"]); }
function _gemIsOutdoor(p){ return hasAny(gemTextOf(p),["park","garden","beach","viewpoint","walk","hike","river","lake","square","market","outdoor","lookout"]); }
function isTouristy(p){ return hasAny(gemTextOf(p),["top attraction","must-see","most famous","world-famous","iconic","main attraction","tourist hotspot","very crowded","highly touristic"]); }
function looksHiddenGem(p){ return hasAny(gemTextOf(p),["hidden gem","local favorite","locals love","quiet","tucked away","off the beaten path","neighborhood spot","independent","small gallery","artisan","family-run","less crowded"]); }
function categoryFit(p,interests=[]){
  const t=gemTextOf(p); let score=0;
  const map={"Food & Dining":["restaurant","cafe","bakery","food","wine","bar","bistro"],"Culture":["culture","museum","gallery","theater","music","history"],"History":["history","historic","cathedral","church","palace","fort"],"Nightlife":["bar","cocktail","club","live music","nightlife","pub"],"Nature":["park","garden","lake","river","beach","hike"],"Art":["art","gallery","museum","atelier","studio"],"Shopping":["market","boutique","shop","vintage","design store"],"Hidden Spots":["hidden gem","quiet","off the beaten path","locals love"],"Architecture":["architecture","cathedral","palace","facade","tower"],"Sports":["stadium","sports","climbing","surf","fitness"],"Wellness":["spa","wellness","sauna","yoga"],"Photography":["viewpoint","sunset","lookout","scenic","photography"]};
  for(const i of interests){ const keys=map[i]||[]; if(hasAny(t,keys)) score+=8; }
  return score;
}
function styleFit(p,style="medium"){
  const level=parsePriceLevel(p.price||p.priceLevel||"");
  if(style==="budget"){ if(level<=1) return 8; if(level===2) return 2; return -8; }
  if(style==="luxury"){ if(level>=3) return 8; if(level===2) return 2; return -4; }
  return 3;
}
function timeFit(p,period="afternoon"){
  const t=gemTextOf(p); let score=0;
  if(period==="morning"){ if(hasAny(t,["cafe","bakery","market","walk","garden"])) score+=8; if(hasAny(t,["club","cocktail","nightlife"])) score-=10; }
  if(period==="midday"){ if(hasAny(t,["restaurant","market","museum","gallery"])) score+=8; }
  if(period==="afternoon"){ if(hasAny(t,["gallery","museum","viewpoint","design store"])) score+=7; }
  if(period==="evening"){ if(hasAny(t,["bar","cocktail","wine","live music","restaurant"])) score+=10; if(hasAny(t,["cathedral","museum"])) score-=4; }
  return score;
}
function gemWeatherFit(p,wf){
  if(!weatherLooksRainy(wf)) return 0;
  if(_gemIsIndoor(p)) return 10;
  if(_gemIsOutdoor(p)) return -12;
  return 0;
}
function uniquenessPenalty(p,existing=[]){
  const t=gemTextOf(p); let penalty=0;
  for(const act of existing){
    const a=gemTextOf(act); if(!a) continue;
    if((t.includes("museum")&&a.includes("museum"))||(t.includes("gallery")&&a.includes("gallery"))||(t.includes("restaurant")&&a.includes("restaurant"))||(t.includes("bar")&&a.includes("bar"))||(t.includes("viewpoint")&&a.includes("viewpoint"))) penalty+=5;
  }
  return penalty;
}
function scoreHiddenGem(p,context){
  let score=0;
  if(looksHiddenGem(p)) score+=18;
  if(isTouristy(p)) score-=16;
  score+=categoryFit(p,context.interests);
  score+=styleFit(p,context.style);
  score+=timeFit(p,context.period);
  score+=gemWeatherFit(p,context.weatherForecast);
  const rating=Number(p.rating||0);
  if(!Number.isNaN(rating)) score+=Math.min(Math.max(rating-3.5,0),1.5)*6;
  const reviews=Number(p.userRatingCount||p.reviewCount||0);
  if(reviews>20&&reviews<600) score+=4;
  if(reviews>5000) score-=4;
  score-=uniquenessPenalty(p,context.existingActivities);
  return score;
}
function rankHiddenGems(places,context){
  return [...(places||[])].map((p,i)=>({...p,hiddenGemScore:scoreHiddenGem(p,context),_idx:i})).sort((a,b)=>b.hiddenGemScore!==a.hiddenGemScore?b.hiddenGemScore-a.hiddenGemScore:a._idx-b._idx).map(({_idx,...rest})=>rest);
}
function selectTopHiddenGems(places,context,limit=4){
  return rankHiddenGems(places,context).filter(p=>p.hiddenGemScore>0).slice(0,limit).map(p=>({
    _id:p._id||uid(),name:p.name||"Hidden gem",type:p.type||"Place",desc:p.desc||p.editorialSummary||"",address:p.address||p.formattedAddress||"",duration:p.duration||"1h 30m",time:p.time||"",price:p.price||"Free",isFree:!!p.isFree||String(p.price||"").toLowerCase().includes("free"),
    openHours:p.openHours||"",tip:p.tip||"Less obvious pick chosen for better local fit and lower tourist density.",imgQuery:p.imgQuery||p.name||"hidden gem",rating:p.rating||null,hiddenGemScore:p.hiddenGemScore,hiddenGem:true
  }));
}

// ── Trip Personality Engine ───────────────────────────────────────────────────
const TRIP_PERSONALITIES = {
  explorer:  {id:"explorer",  label:"🗺️ Explorer",         description:"Packed days, lots of variety, mix of must-sees and hidden corners.",     pace:"fast",   diningStyle:"local",      activityBias:["sightseeing","walking","culture","landmark"]},
  relaxed:   {id:"relaxed",   label:"☀️ Relaxed",           description:"Slow mornings, fewer activities, time to breathe and soak it in.",       pace:"slow",   diningStyle:"sit-down",   activityBias:["park","cafe","garden","scenic","viewpoint"]},
  foodie:    {id:"foodie",    label:"🍽️ Foodie",            description:"Built around meals, markets, and culinary experiences.",                  pace:"medium", diningStyle:"restaurant", activityBias:["food","market","dining","restaurant","tasting"]},
  cultural:  {id:"cultural",  label:"🎭 Cultural Deep-Dive",description:"Museums, history, arts, and local traditions take center stage.",         pace:"medium", diningStyle:"local",      activityBias:["museum","history","art","gallery","heritage"]},
  adventure: {id:"adventure", label:"⚡ Adventure",          description:"Active, outdoorsy, physically engaging — no lazy mornings.",              pace:"fast",   diningStyle:"quick",      activityBias:["outdoor","sport","hike","nature","activity"]},
  luxury:    {id:"luxury",    label:"✨ Luxury",             description:"Premium experiences, fine dining, spas, and high-end stays.",             pace:"medium", diningStyle:"fine-dining",activityBias:["luxury","spa","premium","rooftop","exclusive"]},
  budget:    {id:"budget",    label:"💸 Budget Traveller",  description:"Free attractions, street food, local transport, maximum value.",          pace:"fast",   diningStyle:"street",     activityBias:["free","walking","market","street","gratis"]},
  romantic:  {id:"romantic",  label:"💑 Romantic",          description:"Intimate settings, scenic spots, candlelit dinners, and memorable moments.",pace:"slow",  diningStyle:"fine-dining",activityBias:["scenic","sunset","panoramic","garden","view"]},
};
function getDefaultPersonalityFromForm(form){
  const interests=(form?.interests||[]).map(s=>s.toLowerCase());
  const style=(form?.style||"").toLowerCase();
  if(interests.some(i=>["food","foodie","dining","culinary","restaurant"].includes(i))) return "foodie";
  if(interests.some(i=>["hiking","outdoor","adventure","sport","climbing"].includes(i))) return "adventure";
  if(interests.some(i=>["museum","history","art","culture","gallery"].includes(i))) return "cultural";
  if(style==="luxury") return "luxury";
  if(style==="budget") return "budget";
  if(style==="relaxed"||style==="slow") return "relaxed";
  return "explorer";
}
function applyTripPersonalityToDay(day,form,personalityId,totalDays){
  const p=TRIP_PERSONALITIES[personalityId]||TRIP_PERSONALITIES.explorer;
  let acts=[...(day.activities||[])];
  if(p.pace==="slow") acts=acts.slice(0,Math.max(2,Math.ceil(acts.length*0.65)));
  const scored=acts.map(a=>{
    const text=[a.name,a.type,a.desc].join(" ").toLowerCase();
    return {...a,_pScore:p.activityBias.some(k=>text.includes(k))?1:0};
  });
  const sorted=[...scored].sort((a,b)=>b._pScore-a._pScore).map(({_pScore,...rest})=>rest);
  return optimizeDayPlan({...day,activities:sorted},form,totalDays);
}
function applyTripPersonalityToTrip(days,form,personalityId){
  return days.map(d=>applyTripPersonalityToDay(d,{...form,personalityId},personalityId,days.length));
}

// ── Budget enforcement: actually removes/downgrades expensive items ───────────
function adjustDaysToBudget(days,totalLimit){
  const currentTotal=computeTripBudget(days).total;
  if(currentTotal<=totalLimit) return days;
  let toSave=currentTotal-totalLimit;

  // Deep-clone so we don't mutate original state
  const newDays=days.map(d=>({
    ...d,
    activities:(d.activities||[]).map(a=>({...a})),
    lunch:d.lunch?{...d.lunch}:d.lunch,
    dinner:d.dinner?{...d.dinner}:d.dinner,
  }));

  // Build candidate cuts: each has a saving amount and an apply() that mutates newDays
  const candidates=[];
  newDays.forEach((d)=>{
    // Activities: remove entirely (most expensive first)
    (d.activities||[]).forEach((a)=>{
      const p=parseEuro(a.price);
      if(p>0&&!a.locked) candidates.push({saving:p,apply:()=>{a._remove=true;}});
    });
    // Dinner: downgrade to max €12 if more expensive
    if(d.dinner){
      const p=parseEuro(d.dinner.price);
      const cheap=12;
      if(p>cheap) candidates.push({saving:p-cheap,apply:()=>{
        d.dinner={...d.dinner,name:"Lokales Restaurant / Imbiss",price:`€${cheap}`,desc:"Budgetfreundliche Abendoption"};
      }});
    }
    // Lunch: downgrade to max €8 if more expensive
    if(d.lunch){
      const p=parseEuro(d.lunch.price);
      const cheap=8;
      if(p>cheap) candidates.push({saving:p-cheap,apply:()=>{
        d.lunch={...d.lunch,name:"Streetfood / lokales Café",price:`€${cheap}`,desc:"Budgetfreundliche Mittagsoption"};
      }});
    }
  });

  // Cut most-expensive items first
  candidates.sort((a,b)=>b.saving-a.saving);
  for(const c of candidates){
    if(toSave<=0) break;
    c.apply();
    toSave-=c.saving;
  }

  // Strip removed activities and return
  return newDays.map(d=>({...d,activities:d.activities.filter(a=>!a._remove)}));
}

function adjustDayToBudget(day,dayLimit){
  const current=computeDayBudget(day);
  if(current.total<=dayLimit) return day;
  return adjustDaysToBudget([day],dayLimit)[0];
}
function buildPersonalityPromptBlock(personalityId){
  const p=TRIP_PERSONALITIES[personalityId]||TRIP_PERSONALITIES.explorer;
  return `Trip personality: ${p.label} — ${p.description} Pace: ${p.pace}. Preferred dining: ${p.diningStyle}. Prioritize activity types: ${p.activityBias.join(", ")}.`;
}

// ── Route Optimizer ───────────────────────────────────────────────────────────
function haversineKm(a,b){
  const R=6371,dLat=(b.lat-a.lat)*Math.PI/180,dLng=(b.lng-a.lng)*Math.PI/180;
  const lat1=a.lat*Math.PI/180,lat2=b.lat*Math.PI/180;
  const x=Math.sin(dLat/2)**2+Math.sin(dLng/2)**2*Math.cos(lat1)*Math.cos(lat2);
  return R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));
}
function estimateTravelMinutes(km,transport="mixed"){
  if(transport==="walking") return Math.max(8,Math.round(km*14));
  if(transport==="car") return Math.max(6,Math.round(km*3.2));
  if(transport==="public") return Math.max(10,Math.round(km*6.5));
  return Math.max(8,Math.round(km*5));
}
// ── Geocoding with in-memory cache + rate-limited parallelism ────────────────
const _geoCache=new Map();
const _geoInflight=new Map(); // dedup concurrent identical requests

async function geocodeQuery(query){
  if(_geoCache.has(query)) return _geoCache.get(query);
  if(_geoInflight.has(query)) return _geoInflight.get(query);
  const p=(async()=>{
    const url="https://nominatim.openstreetmap.org/search?format=json&limit=1&q="+encodeURIComponent(query);
    const res=await fetch(url); if(!res.ok) throw new Error("Geocoding failed");
    const d=await res.json();
    const result=d?.[0]?{lat:Number(d[0].lat),lng:Number(d[0].lon)}:null;
    _geoCache.set(query,result);
    _geoInflight.delete(query);
    return result;
  })();
  _geoInflight.set(query,p);
  return p;
}
// Geocode with viewbox bias (for city-scoped searches)
async function geocodeLocal(query,viewbox){
  const cacheKey=viewbox?query+'\x00'+viewbox:query;
  if(_geoCache.has(cacheKey)) return _geoCache.get(cacheKey);
  if(_geoInflight.has(cacheKey)) return _geoInflight.get(cacheKey);
  const p=(async()=>{
    if(viewbox){
      const url=`https://nominatim.openstreetmap.org/search?format=json&limit=3&q=${encodeURIComponent(query)}&viewbox=${viewbox}&bounded=1`;
      const d=await fetch(url).then(r=>r.json()).catch(()=>[]);
      if(d?.[0]){const r={lat:+d[0].lat,lng:+d[0].lon};_geoCache.set(cacheKey,r);_geoInflight.delete(cacheKey);return r;}
    }
    // Fallback to unbounded
    const r=await geocodeQuery(query);
    _geoCache.set(cacheKey,r);
    _geoInflight.delete(cacheKey);
    return r;
  })();
  _geoInflight.set(cacheKey,p);
  return p;
}
// Run multiple geocode calls with concurrency limit (respects Nominatim fair use)
async function geocodeBatch(tasks,concurrency=3){
  const results=new Array(tasks.length);
  let idx=0;
  async function worker(){
    while(idx<tasks.length){
      const i=idx++;
      try{ results[i]=await tasks[i](); }
      catch(_){ results[i]=null; }
    }
  }
  await Promise.all(Array.from({length:Math.min(concurrency,tasks.length)},()=>worker()));
  return results;
}
async function geocodeStop(stop,destination){
  if(stop?.lat!=null&&stop?.lng!=null) return {lat:Number(stop.lat),lng:Number(stop.lng)};
  const query=[stop.address,stop.name,destination].filter(Boolean).join(", ");
  return geocodeQuery(query);
}
async function geocodeStops(stops,destination){
  // Parallel batch — up to 3 concurrent requests
  const tasks=stops.map(s=>()=>geocodeStop(s,destination));
  const coords=await geocodeBatch(tasks,3);
  return stops.map((s,i)=>({...s,lat:coords[i]?.lat??null,lng:coords[i]?.lng??null}));
}
function nearestNeighborOrder(stops,startPoint){
  const withCoords=stops.filter(s=>s.lat!=null&&s.lng!=null);
  const withoutCoords=stops.filter(s=>s.lat==null||s.lng==null);
  const remaining=[...withCoords]; const ordered=[]; let current=startPoint;
  while(remaining.length){
    let bestIdx=0,bestDist=Infinity;
    for(let i=0;i<remaining.length;i++){ const d=haversineKm(current,remaining[i]); if(d<bestDist){bestDist=d;bestIdx=i;} }
    const [picked]=remaining.splice(bestIdx,1); ordered.push(picked); current=picked;
  }
  return [...ordered,...withoutCoords];
}
function keepUserOrderButRetime(stops,startPoint,transport){
  let current=startPoint;
  return stops.map(s=>{
    let travelMinutes=0;
    if(current?.lat!=null&&current?.lng!=null&&s?.lat!=null&&s?.lng!=null)
      travelMinutes=estimateTravelMinutes(haversineKm(current,s),transport);
    current=s;
    return {...s,_route:{...(s._route||{}),travelMinutesFromPrev:travelMinutes}};
  });
}
function applyTimesRoute(stops,dayStart,dayEnd){
  let cursor=dayStart;
  return stops.map(s=>{
    const travel=s?._route?.travelMinutesFromPrev||0; cursor+=travel;
    const duration=parseDurationToMinutes(s.duration);
    const explicitStart=s.locked?toMins(s.time):null;
    const start=explicitStart!=null&&explicitStart>cursor?explicitStart:cursor;
    const end=start+duration;
    const next={...s,time:fmtTime(start),endTime:fmtTime(end),conflict:end>dayEnd,travelMinutesFromPrev:travel,travelLabelFromPrev:travel?`${travel} min`:""};
    cursor=end+20; return next;
  });
}
function buildRouteSegments(stops,startPoint,transport){
  const segments=[]; let prev=startPoint;
  for(const s of stops){
    if(prev?.lat!=null&&prev?.lng!=null&&s?.lat!=null&&s?.lng!=null){
      const km=haversineKm(prev,s),mins=estimateTravelMinutes(km,transport);
      segments.push({from:prev.name||"Start",to:s.name,km:Number(km.toFixed(2)),minutes:mins});
    } else { segments.push({from:prev?.name||"Start",to:s.name,km:null,minutes:null}); }
    prev=s;
  }
  return segments;
}
async function optimizeRouteForDay({day,form,totalDays,destination,hotel,keepUserSequence=false}){
  const rawStops=(day.activities||[]).map((a,idx)=>({...a,_originalIndex:idx}));
  const geocodedStops=await geocodeStops(rawStops,destination);
  let startPoint=null;
  if(hotel){ const hc=await geocodeQuery([hotel,destination].filter(Boolean).join(", ")); startPoint={name:hotel,lat:hc?.lat??null,lng:hc?.lng??null}; }
  const routeBase=startPoint||{name:destination,lat:geocodedStops.find(s=>s.lat!=null)?.lat??null,lng:geocodedStops.find(s=>s.lng!=null)?.lng??null};
  let orderedStops;
  if(keepUserSequence){
    orderedStops=keepUserOrderButRetime(geocodedStops,routeBase,form.transport);
  } else {
    const locked=geocodedStops.filter(s=>s.locked),unlocked=geocodedStops.filter(s=>!s.locked);
    const reorderedUnlocked=nearestNeighborOrder(unlocked,routeBase);
    // Interleave: sort everything by time when available, locked respected, unlocked fills gaps
    const merged=[...locked,...reorderedUnlocked].sort((a,b)=>{
      const at=toMins(a.time)||0, bt=toMins(b.time)||0;
      if(at&&bt) return at-bt;            // both have times → sort by time
      if(at) return -1;                   // a has time → earlier
      if(bt) return 1;                    // b has time → earlier
      return a._originalIndex-b._originalIndex; // neither → original order
    });
    orderedStops=keepUserOrderButRetime(merged,routeBase,form.transport);
  }
  const dayStart=getDayStart(day,form),dayEnd=getDayEnd(day,form,totalDays);
  const timedStops=applyTimesRoute(orderedStops,dayStart,dayEnd);
  const segments=buildRouteSegments(timedStops,routeBase,form.transport);
  return {...day,activities:timedStops.map(s=>({...s,lat:s.lat,lng:s.lng})),routeMeta:{optimizedAt:new Date().toISOString(),keepUserSequence,startPoint:routeBase.name,segments}};
}
async function retimeAfterManualReorder({day,form,totalDays,destination,hotel}){
  return optimizeRouteForDay({day,form,totalDays,destination,hotel,keepUserSequence:true});
}
function reorderActivitiesLocally(activities,fromIndex,toIndex){
  const next=[...activities]; const [moved]=next.splice(fromIndex,1); next.splice(toIndex,0,moved); return next;
}

// ── AI Travel Concierge ────────────────────────────────────────────────────────
const weatherIsRainy=weatherLooksRainy; // alias — same logic, one source of truth
function summarizeDay(day){
  return{day:day?.day??null,theme:day?.theme||"",neighborhood:day?.neighborhood||"",weatherForecast:day?.weatherForecast||"",timeWindow:day?.timeWindow||"",
    activities:(day?.activities||[]).map(a=>({id:a._id||a.name,name:a.name||"",type:a.type||"",time:a.time||"",duration:a.duration||"",price:a.price||"",address:a.address||"",desc:a.desc||"",isFree:!!a.isFree})),
    lunch:day?.lunch||null,dinner:day?.dinner||null};
}
function buildConciergePrompt({destination,hotel,currentDay,allDays,activeDayIndex,userMessage,userLoc,travelers,ageGroup,style,interests}){
  const day=summarizeDay(currentDay);
  const rainy=weatherIsRainy(day.weatherForecast);
  return `You are TripMind Concierge, an elite in-trip AI travel assistant.
Reply ONLY with valid JSON. No markdown. No explanation outside JSON.
Your job: answer the user's travel question. Be concrete, useful, action-oriented. If weather is rainy, prioritize indoor options. If the user asks for a swap, provide replacement suggestions.
Return JSON in exactly this shape:
{"answerTitle":"","answerText":"","mode":"advice","quickActions":[{"label":"","type":"tip"}],"suggestions":[{"name":"","type":"","desc":"","reason":"","time":"","duration":"","price":"","isFree":false,"address":"","tip":"","transport":"","bookingUrl":"","imgQuery":""}]}
Constraints: suggestions 0-4, quickActions 0-4.
Trip context: destination:${JSON.stringify(destination||"")} hotel:${JSON.stringify(hotel||"")} travelers:${JSON.stringify(travelers??"")} ageGroup:${JSON.stringify(ageGroup||"")} style:${JSON.stringify(style||"")} interests:${JSON.stringify(interests||[])} activeDayIndex:${JSON.stringify(activeDayIndex)} currentDay:${JSON.stringify(day)} allDaysSummary:${JSON.stringify((allDays||[]).map(d=>({day:d.day,theme:d.theme||"",weatherForecast:d.weatherForecast||""})))} userLocation:${JSON.stringify(userLoc||null)} rainyContext:${JSON.stringify(rainy)}
User request: ${JSON.stringify(userMessage||"")}`.trim();
}
// ── Concierge API call — uses /api/chat (server-side key, never in browser) ────
async function callConciergeAPI(prompt,maxTok=1200,attempt=0){
  try{
    const res=await fetch("/api/chat",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({messages:[{role:"user",content:prompt}],max_tokens:maxTok})
    });
    if(!res.ok){
      const t=await res.text().catch(()=>"");
      if((res.status>=500)&&attempt<2){
        await new Promise(r=>setTimeout(r,1500*(attempt+1)));
        return callConciergeAPI(prompt,maxTok,attempt+1);
      }
      throw new Error("Concierge API "+res.status+(t?": "+t.slice(0,120):""));
    }
    const data=await res.json();
    if(data.error) throw new Error(data.error||"AI error");
    const raw=(data.content||[]).map(b=>b.text||"").join("");
    if(!raw.trim()) throw new Error("Empty concierge response");
    return repairJSON(raw);
  }catch(err){
    if((err.name==="TypeError"||/fetch|network/i.test(err.message))&&attempt<2){
      await new Promise(r=>setTimeout(r,1500*(attempt+1)));
      return callConciergeAPI(prompt,maxTok,attempt+1);
    }
    throw err;
  }
}

async function askTravelConcierge({destination,hotel,currentDay,allDays,activeDayIndex,userMessage,userLoc,travelers,ageGroup,style,interests}){
  if(!userMessage?.trim()) throw new Error("Message is empty");
  const prompt=buildConciergePrompt({destination,hotel,currentDay,allDays,activeDayIndex,userMessage,userLoc,travelers,ageGroup,style,interests});
  const data=await callConciergeAPI(prompt,1200);
  return{
    answerTitle:data.answerTitle||"TripMind Concierge",
    answerText:data.answerText||"",
    mode:data.mode||"advice",
    quickActions:Array.isArray(data.quickActions)?data.quickActions.slice(0,4):[],
    suggestions:Array.isArray(data.suggestions)?data.suggestions.slice(0,4).map(s=>({_id:uid(),name:s.name||"Suggested stop",type:s.type||"Activity",desc:s.desc||"",reason:s.reason||"",time:s.time||"",duration:s.duration||"1h 30m",price:s.price||"Free",isFree:!!s.isFree,address:s.address||"",tip:s.tip||"",transport:s.transport||"",bookingUrl:s.bookingUrl||"",imgQuery:s.imgQuery||s.name||"travel",source:"concierge"})):[]
  };
}
function buildQuickPrompt(label){
  return{"Next 2 hours":"What should I do for the next 2 hours?","Rain backup":"It is raining. What should I swap out today?","Dinner now":"Find me a good dinner option for tonight.","Near me now":"What is worth doing near me right now?"}[label]||label;
}

// ── Google Places search ───────────────────────────────────────────────────────
async function searchPlaces({ query, destination }) {
  const textQuery = `${query} in ${destination}`;
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": GOOGLE_PLACES_KEY,
      "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.rating,places.priceLevel,places.websiteUri,places.regularOpeningHours,places.location"
    },
    body: JSON.stringify({ textQuery, pageSize: 5 })
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Places API error: ${res.status} ${text}`);
  }
  const data = await res.json();
  return (data.places || []).map(p => ({
    _id: uid(),
    name: p.displayName?.text || "Unknown place",
    type: "Place",
    desc: `Rating: ${p.rating || "n/a"} · Price: ${p.priceLevel || "n/a"}`,
    address: p.formattedAddress || "",
    duration: "1h 30m",
    price: "Free",
    isFree: true,
    openHours: p.regularOpeningHours?.weekdayDescriptions?.join(" | ") || "",
    websiteUrl: p.websiteUri || "",
    lat: p.location?.latitude ?? null,
    lng: p.location?.longitude ?? null,
    time: "14:00"
  }));
}

// ── DOM element helpers (no innerHTML) ────────────────────────────────────────
function domEl(tag,styles,children){
  const e=document.createElement(tag);
  if(styles) Object.assign(e.style,styles);
  (children||[]).forEach(c=>{
    if(c==null) return;
    e.appendChild(typeof c==="string"?document.createTextNode(c):c);
  });
  return e;
}

// ── DayMap (MapLibre GL) ────────────────────────────────────────────────────────
function DayMap({acts,destination,hotel,isFirstDay,isLastDay,userLoc,onRequestLocation,visible,onReady,zoomToActId}){
  const containerRef=useRef(null);
  const mapRef=useRef(null);
  const markersRef=useRef([]);
  const markerMapRef=useRef({});
  const animRafRef=useRef(null);
  const [mapLoaded,setMapLoaded]=useState(false);
  const [plotting,setPlotting]=useState(false);
  const actNamesKey=acts.map(a=>(a._id||a.name)||'').join('\x00');
  const geoAbortRef=useRef({cancelled:false});

  // ── Build marker DOM elements using only DOM APIs (no innerHTML) ─────────────
  function makeActPin(emoji,num){
    const outer=domEl('div',{position:'relative',width:'48px',height:'48px',borderRadius:'50%',background:'var(--tm-bg)',border:'2.5px solid #111',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 3px 14px rgba(0,0,0,.28)',cursor:'pointer',transition:'filter .18s'});
    const em=domEl('span',{fontSize:'23px',lineHeight:'1',pointerEvents:'none'},[emoji]);
    const badge=domEl('div',{position:'absolute',top:'-6px',right:'-6px',width:'20px',height:'20px',borderRadius:'50%',background:'#111',border:'2px solid #fff',display:'flex',alignItems:'center',justifyContent:'center'});
    badge.appendChild(domEl('span',{fontSize:'9px',fontWeight:'900',color:'#fff',lineHeight:'1'},[String(num)]));
    outer.appendChild(em);outer.appendChild(badge);
    outer.addEventListener('mouseenter',()=>{outer.style.filter='brightness(1.12) drop-shadow(0 4px 8px rgba(0,0,0,.35))';});
    outer.addEventListener('mouseleave',()=>{outer.style.filter='';});
    return outer;
  }
  function makeSquarePin(emoji,bg,labelText,labelColor){
    const outer=domEl('div',{width:'44px',height:'44px',borderRadius:'12px',background:bg,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',boxShadow:'0 4px 16px rgba(0,0,0,.36)',border:'2.5px solid #fff',cursor:'pointer',transition:'filter .18s'});
    outer.appendChild(domEl('span',{fontSize:'19px',lineHeight:'1',pointerEvents:'none'},[emoji]));
    outer.appendChild(domEl('span',{fontSize:'5.5px',color:labelColor||'#fff',fontWeight:'900',letterSpacing:'.04em',marginTop:'1px',pointerEvents:'none'},[labelText]));
    outer.addEventListener('mouseenter',()=>{outer.style.filter='brightness(1.12) drop-shadow(0 4px 8px rgba(0,0,0,.35))';});
    outer.addEventListener('mouseleave',()=>{outer.style.filter='';});
    return outer;
  }
  function makePopup(act,em,dest){
    const gyg='https://www.getyourguide.com/s/?q='+encodeURIComponent(act.name+' '+dest);
    const timing=[act.time,act.duration].filter(Boolean).join(' · ');
    const wrap=domEl('div',{fontFamily:"inherit",maxWidth:'215px'});
    wrap.appendChild(domEl('div',{fontSize:'20px',marginBottom:'4px'},[em]));
    wrap.appendChild(domEl('b',{fontSize:'13px',color:'#2C365A'},[act.name]));
    if(timing) wrap.appendChild(domEl('div',{fontSize:'11px',color:'#555',marginTop:'3px'},[timing]));
    if(act.address) wrap.appendChild(domEl('div',{fontSize:'10px',color:'#8A9CAA',marginTop:'2px'},['📍 '+act.address]));
    wrap.appendChild(domEl('div',{fontSize:'11px',marginTop:'4px',fontWeight:'600',color:act.isFree?'#555':'#111'},[act.isFree?'Kostenlos':(act.price||'')]));
    if(act.transport) wrap.appendChild(domEl('div',{fontSize:'10px',color:'#555',marginTop:'3px'},['🚌 '+act.transport]));
    if(!act.isFree&&act.price){
      const a=domEl('a',{display:'inline-block',marginTop:'7px',padding:'4px 11px',background:'#dc2626',borderRadius:'5px',color:'#fff',fontSize:'11px',fontWeight:'700',textDecoration:'none'},['Buchen']);
      a.href=gyg; a.target='_blank'; a.rel='noopener noreferrer';
      wrap.appendChild(a);
    }
    return wrap;
  }

  // ── Init map once ────────────────────────────────────────────────────────────
  useEffect(()=>{
    if(mapRef.current||!containerRef.current) return;
    const m=new maplibregl.Map({
      container:containerRef.current,
      style:'https://tiles.openfreemap.org/styles/liberty',
      center:[0,20],zoom:2,pitch:30,bearing:0,attributionControl:false,
    });
    m.addControl(new maplibregl.NavigationControl(),'top-right');
    m.on('load',()=>{
      // Colour palette: match app's #111 navy / var(--tm-border) steel-blue scheme
      const safe=(fn)=>{try{fn();}catch(_){}};
      safe(()=>m.setPaintProperty('water','fill-color','#B8D4E8'));
      safe(()=>m.setPaintProperty('waterway','line-color','#9DC2D6'));
      safe(()=>m.setPaintProperty('park','fill-color','#C8DAC8'));
      safe(()=>m.setPaintProperty('landuse-park','fill-color','#C8DAC8'));
      safe(()=>m.setPaintProperty('building','fill-color','#E8ECF0'));
      safe(()=>m.setPaintProperty('building','fill-opacity',.65));
      // Route: fat halo + animated dash on top
      m.addSource('route',{type:'geojson',data:{type:'Feature',geometry:{type:'LineString',coordinates:[]}}});
      m.addLayer({id:'route-halo',type:'line',source:'route',layout:{'line-join':'round','line-cap':'round'},paint:{'line-color':"var(--tm-border)",'line-width':8,'line-opacity':.45}});
      m.addLayer({id:'route-line',type:'line',source:'route',layout:{'line-join':'round','line-cap':'round'},paint:{'line-color':'#111','line-width':3,'line-dasharray':[1,3]}});
      setMapLoaded(true);
    });
    mapRef.current=m;
    return()=>{if(animRafRef.current) cancelAnimationFrame(animRafRef.current);};
  },[]);

  // ── Animate the dashed route line (marching ants effect) ────────────────────
  useEffect(()=>{
    if(!mapLoaded||!mapRef.current) return;
    const m=mapRef.current;
    const steps=[[0,1,3],[.33,1,2.67],[.66,1,2.34],[1,1,2],[0,1,3]];
    let s=0,last=0;
    const tick=(t)=>{
      animRafRef.current=requestAnimationFrame(tick);
      if(t-last<90) return;
      last=t; s=(s+1)%steps.length;
      try{m.setPaintProperty('route-line','line-dasharray',steps[s]);}catch(_){}
    };
    animRafRef.current=requestAnimationFrame(tick);
    return()=>cancelAnimationFrame(animRafRef.current);
  },[mapLoaded]);

  // ── Geocode + place markers whenever the day changes ─────────────────────────
  useEffect(()=>{
    if(!mapRef.current||!mapLoaded) return;
    geoAbortRef.current.cancelled=true;
    const token={cancelled:false};
    geoAbortRef.current=token;
    const m=mapRef.current;
    markersRef.current.forEach(mk=>mk.remove());
    markersRef.current=[];markerMapRef.current={};
    if(m.getSource('route')) m.getSource('route').setData({type:'Feature',geometry:{type:'LineString',coordinates:[]}});
    setPlotting(true);
    const allPoints=[];

    function renderMarkers(){
      if(token.cancelled) return;
      setPlotting(false);
      if(!allPoints.length) return;
      const hotelPt=allPoints.find(p=>p.kind==='hotel');
      const airportPt=allPoints.find(p=>p.kind==='airport');
      const actPts=[...allPoints.filter(p=>p.kind==='act')].sort((a,b)=>a.idx-b.idx);
      // fitBounds — auto-zoom so all stops of this day fit perfectly
      const coords=allPoints.map(p=>[p.lng,p.lat]);
      try{
        const bounds=coords.reduce((b,c)=>b.extend(c),new maplibregl.LngLatBounds(coords[0],coords[0]));
        m.fitBounds(bounds,{padding:{top:60,bottom:80,left:60,right:60},maxZoom:14,duration:900});
      }catch(_){}
      // Update animated route line
      const routeCoords=[];
      if(hotelPt) routeCoords.push([hotelPt.lng,hotelPt.lat]);
      actPts.forEach(p=>routeCoords.push([p.lng,p.lat]));
      if(airportPt) routeCoords.push([airportPt.lng,airportPt.lat]);
      if(routeCoords.length>1&&m.getSource('route'))
        m.getSource('route').setData({type:'Feature',geometry:{type:'LineString',coordinates:routeCoords}});
      // Hotel pin
      if(hotelPt){
        const el=makeSquarePin('🏨','#555','HOTEL');
        const mk=new maplibregl.Marker({element:el,anchor:'bottom'})
          .setLngLat([hotelPt.lng,hotelPt.lat])
          .setPopup(new maplibregl.Popup({offset:14,maxWidth:'200px'}).setDOMContent(domEl('div',{fontFamily:"inherit",fontSize:'13px'},[domEl('b',{},['\uD83C\uDFE8 '+hotel]),domEl('div',{fontSize:'11px',color:'#555',marginTop:'3px'},[t(getLang(),"yourHotel")])])))
          .addTo(m);
        markersRef.current.push(mk);
      }
      // Activity pins
      actPts.forEach(p=>{
        const act=p.act;const em=typeEmoji(act.type);
        const el=makeActPin(em,p.idx+1);
        const mk=new maplibregl.Marker({element:el,anchor:'center'})
          .setLngLat([p.lng,p.lat])
          .setPopup(new maplibregl.Popup({offset:30,maxWidth:'230px'}).setDOMContent(makePopup(act,em,destination)))
          .addTo(m);
        markersRef.current.push(mk);
        markerMapRef.current[act._id||act.name]={marker:mk,lat:p.lat,lng:p.lng};
      });
      // Airport pin
      if(airportPt){
        const label=isFirstDay&&isLastDay?'AIRPORT':isFirstDay?'ARRIVAL':'DEPART';
        const el=makeSquarePin('✈️','#111',label,"var(--tm-border)");
        const mk=new maplibregl.Marker({element:el,anchor:'bottom'})
          .setLngLat([airportPt.lng,airportPt.lat])
          .setPopup(new maplibregl.Popup({offset:14}).setDOMContent(domEl('div',{fontFamily:"inherit",fontSize:'13px'},[domEl('b',{},['✈️ '+(isFirstDay&&isLastDay?'An- & Abreise':isFirstDay?'Ankunft':'Abreise')])])))
          .addTo(m);
        markersRef.current.push(mk);
      }
      // User location dot
      if(userLoc){
        const el=domEl('div',{width:'14px',height:'14px',borderRadius:'50%',background:'#111',border:'3px solid #fff',boxShadow:'0 0 0 3px rgba(47,65,86,.3)'});
        const mk=new maplibregl.Marker({element:el,anchor:'center'})
          .setLngLat([userLoc.lng,userLoc.lat])
          .setPopup(new maplibregl.Popup({offset:12}).setDOMContent(domEl('b',{},['Du bist hier'])))
          .addTo(m);
        markersRef.current.push(mk);
      }
      // Expose zoomTo API to plan-tab
      if(onReady) onReady({zoomTo:(actId)=>{
        const entry=markerMapRef.current[actId];
        if(entry&&mapRef.current){
          mapRef.current.flyTo({center:[entry.lng,entry.lat],zoom:16,speed:.9,essential:true});
          setTimeout(()=>{try{entry.marker.togglePopup();}catch(_){}},600);
        }
      }});
    }

    async function runAllGeocode(){
      // 1. Geocode city center first (needed for viewbox bias)
      const cityCoord=await geocodeQuery(destination);
      if(token.cancelled) return;
      const cityCenter=cityCoord||null;
      if(cityCenter) m.flyTo({center:[cityCenter.lng,cityCenter.lat],zoom:12,duration:800});
      const vb=cityCenter?`${cityCenter.lng-.15},${cityCenter.lat+.15},${cityCenter.lng+.15},${cityCenter.lat-.15}`:null;

      // 2. Build all geocode tasks — hotel, airport, activities — run in parallel
      const tasks=[];
      const taskMeta=[]; // track what each task result maps to

      if(hotel){
        tasks.push(()=>geocodeLocal(hotel+', '+destination,vb));
        taskMeta.push({kind:'hotel'});
      }
      if(isFirstDay||isLastDay){
        tasks.push(()=>geocodeQuery('international airport '+destination));
        taskMeta.push({kind:'airport'});
      }
      if(acts?.length){
        acts.forEach((act,i)=>{
          if(act.lat&&act.lng){
            const ok=!cityCenter||(Math.abs(act.lat-cityCenter.lat)<.5&&Math.abs(act.lng-cityCenter.lng)<.5);
            if(ok){
              // Already geocoded — skip network, add directly
              allPoints.push({lat:act.lat,lng:act.lng,kind:'act',act,idx:i});
              return;
            }
          }
          const q=act.name+(act.address?', '+act.address:'')+', '+destination;
          tasks.push(()=>geocodeLocal(q,vb));
          taskMeta.push({kind:'act',act,idx:i});
        });
      }

      // Run all remaining geocode tasks with concurrency=3 (cache makes repeated queries instant)
      const results=await geocodeBatch(tasks,3);
      if(token.cancelled) return;

      results.forEach((coord,ti)=>{
        if(!coord) return;
        const meta=taskMeta[ti];
        allPoints.push({lat:coord.lat,lng:coord.lng,kind:meta.kind,...(meta.kind==='act'?{act:meta.act,idx:meta.idx}:{})});
      });

      if(!token.cancelled) renderMarkers();
    }
    runAllGeocode();
    return()=>{token.cancelled=true;};
  },[mapLoaded,actNamesKey,destination,hotel,isFirstDay,isLastDay,userLoc]);

  // Zoom to specific activity (from plan-tab tap)
  useEffect(()=>{
    if(!zoomToActId) return;
    const entry=markerMapRef.current[zoomToActId];
    if(entry&&mapRef.current){
      mapRef.current.flyTo({center:[entry.lng,entry.lat],zoom:16,speed:.9,essential:true});
      setTimeout(()=>{try{entry.marker.togglePopup();}catch(_){}},600);
    }
  },[zoomToActId]);

  // Resize map when tab reveals it
  useEffect(()=>{
    if(visible&&mapRef.current){
      setTimeout(()=>{try{mapRef.current.resize();}catch(_){}},60);
      setTimeout(()=>{try{mapRef.current.resize();}catch(_){}},320);
    }
  },[visible]);

  const navUrl=()=>{
    const stops=(acts||[]).map(a=>encodeURIComponent((a.name||'')+' '+destination));
    const orig=hotel?encodeURIComponent(hotel+', '+destination):(stops[0]||'');
    if(!stops.length) return 'https://www.google.com/maps/search/'+encodeURIComponent(hotel||destination);
    return 'https://www.google.com/maps/dir/'+orig+'/'+stops.join('/');
  };

  return(
    <div style={{display:visible?'block':'none'}}>
      <div style={{position:'relative',borderRadius:16,overflow:'hidden',border:'1px solid var(--tm-border)',marginBottom:10,height:300,background:"var(--tm-surface2)"}}>
        <div ref={containerRef} style={{width:'100%',height:'100%'}}/>
        {!mapLoaded&&(
          <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:10,background:'rgba(247,247,247,.95)'}}>
            <Spin size={26}/><div style={{fontSize:'.78rem',color:'#555'}}>Karte wird geladen…</div>
          </div>
        )}
        {mapLoaded&&plotting&&(
          <div style={{position:'absolute',bottom:12,left:'50%',transform:'translateX(-50%)',background:'rgba(17,17,17,.88)',color:'#fff',fontSize:'.7rem',padding:'5px 14px',borderRadius:50,whiteSpace:'nowrap',pointerEvents:'none',backdropFilter:'blur(6px)'}}>
            Stops werden eingezeichnet…
          </div>
        )}
        {mapLoaded&&!plotting&&(hotel||(isFirstDay||isLastDay))&&(
          <div style={{position:'absolute',top:10,left:10,display:'flex',flexDirection:'column',gap:4,pointerEvents:'none',zIndex:1}}>
            {hotel&&<div style={{background:'rgba(255,255,255,.92)',backdropFilter:'blur(6px)',borderRadius:6,padding:'3px 8px',fontSize:'.62rem',fontWeight:700,color:'#555',display:'flex',alignItems:'center',gap:4}}>🏨 Hotel</div>}
            {(isFirstDay||isLastDay)&&<div style={{background:'rgba(255,255,255,.92)',backdropFilter:'blur(6px)',borderRadius:6,padding:'3px 8px',fontSize:'.62rem',fontWeight:700,color:'#111',display:'flex',alignItems:'center',gap:4}}>✈️ {isFirstDay&&isLastDay?'Airport':isFirstDay?'Arrival':'Departure'}</div>}
          </div>
        )}
      </div>
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
        {!userLoc
          ?<button onClick={onRequestLocation} style={{padding:'10px 15px',borderRadius:9,background:'#111',border:'none',color:'#fff',fontSize:'.82rem',fontWeight:700,fontFamily:'inherit',minHeight:44,cursor:'pointer'}}>📍 Mein Standort</button>
          :<span style={{padding:'9px 13px',borderRadius:9,background:"var(--tm-surface)",border:'1px solid var(--tm-border)',fontSize:'.8rem',color:'var(--tm-text2)',fontWeight:600}}>📍 Aktiv</span>
        }
        <a href={navUrl()} target="_blank" rel="noreferrer" style={{padding:'10px 15px',borderRadius:9,background:'#111',border:'none',color:'#fff',fontSize:'.82rem',fontWeight:700,display:'flex',alignItems:'center',gap:5,minHeight:44,textDecoration:'none'}}>🧭 Tag navigieren</a>
      </div>
    </div>
  );
}

// ── Unified Activity Card (Focus Mode redesign) ────────────────────────────────
function ActCard({act,onRemove}){
  const [src,onImgErr]=useActivityPhoto(act.imgQuery,act.name);
  const [open,setOpen]=useState(false);
  const em=typeEmoji(act.type);
  const bookUrl="https://www.getyourguide.com/s/?q="+encodeURIComponent((act.name||"")+" "+(act.address||""));
  const timeParts=(act.time||"--:--").split(":");
  const hh=timeParts[0]||"--";
  const mm=timeParts[1]||"00";
  return(
    <div className="fu" style={{background:"var(--tm-bg)",borderRadius:16,overflow:"hidden",boxShadow:"0 2px 14px rgba(47,65,86,.10)",border:"1px solid rgba(200,217,230,.55)",marginBottom:10}}>
      {/* Status badges (conflict / weather / hidden gem) */}
      {(act.conflict||act.weatherWarning||act.isHidden)&&(
        <div style={{display:"flex",gap:5,padding:"7px 10px 0",flexWrap:"wrap"}}>
          {act.conflict&&<span style={{fontSize:".62rem",padding:"2px 8px",background:"#fef2f2",border:"1px solid #fecaca",borderRadius:99,color:"#dc2626",fontWeight:700}}>⚠ Zeitkonflikt</span>}
          {act.weatherWarning&&<span style={{fontSize:".72rem",padding:"4px 10px",background:"#DBEAFE",border:"1.5px solid #93C5FD",borderRadius:99,color:"#1D4ED8",fontWeight:700,display:"flex",alignItems:"center",gap:4}}>🌧 Outdoor bei Regen — ggf. ersetzen</span>}
          {act.isHidden&&<span style={{fontSize:".62rem",padding:"2px 8px",background:"#fef9c3",border:"1px solid #fde047",borderRadius:99,color:"#92400e",fontWeight:700}}>✨ Hidden Gem</span>}
        </div>
      )}
      {/* Main row */}
      <div style={{display:"flex",alignItems:"stretch",minHeight:90}}>
        {/* Left: time column */}
        <div style={{width:62,flexShrink:0,background:"var(--tm-surface)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"10px 2px",gap:1,borderRight:"1px solid var(--tm-border)"}}>
          <span style={{fontSize:"1.1rem",fontWeight:900,color:"var(--tm-text)",lineHeight:1,letterSpacing:"-.02em"}}>{hh}</span>
          <span style={{fontSize:".7rem",fontWeight:700,color:"var(--tm-text3)",lineHeight:1}}>:{mm}</span>
          <span style={{fontSize:"1rem",marginTop:4,lineHeight:1}}>{em}</span>
        </div>
        {/* Center: content */}
        <div style={{flex:1,padding:"11px 11px 9px",minWidth:0}}>
          <div style={{fontWeight:800,fontSize:"1rem",color:"var(--tm-text)",lineHeight:1.2,marginBottom:4,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{act.name}</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center",marginBottom:act.desc?4:0}}>
            {act.duration&&<span style={{fontSize:".7rem",color:"var(--tm-text3)"}}>⏱ {act.duration}</span>}
            {act.isFree
              ?<span style={{fontSize:".7rem",fontWeight:700,color:"#16a34a"}}>Free</span>
              :act.price&&<span style={{fontSize:".7rem",color:"var(--tm-text2)"}}>{act.price}</span>}
            {act.travelLabelFromPrev&&<span style={{fontSize:".65rem",color:"var(--tm-border)",fontStyle:"italic"}}>{act.travelLabelFromPrev}</span>}
          </div>
          {act.desc&&<p style={{fontSize:".75rem",color:"var(--tm-text3)",lineHeight:1.4,margin:0,overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>{act.desc}</p>}
        </div>
        {/* Right: photo thumbnail */}
        <div style={{width:78,flexShrink:0,position:"relative",overflow:"hidden",background:"var(--tm-surface2)"}}>
          {src&&<img src={src} alt={act.name} loading="lazy" onError={onImgErr} style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/>}
          <button onClick={()=>onRemove(act._id||act.name)} style={{position:"absolute",top:6,right:6,width:22,height:22,borderRadius:"50%",background:"rgba(0,0,0,.45)",border:"none",color:"#fff",fontSize:".7rem",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>×</button>
        </div>
      </div>
      {/* Action bar */}
      <div style={{padding:"7px 10px",borderTop:"1px solid #F0F4F7",display:"flex",gap:5,alignItems:"center",background:"#FAFAF9"}}>
        <span style={{fontSize:".7rem",color:"var(--tm-border)",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{act.type||"Activity"}</span>
        {!act.isFree&&<a href={bookUrl} target="_blank" rel="noreferrer" style={{padding:"5px 10px",background:"#dc2626",borderRadius:7,color:"#fff",fontSize:".7rem",fontWeight:700,textDecoration:"none",flexShrink:0}}>Book</a>}
        <a href={"https://www.google.com/maps/search/"+encodeURIComponent(act.name)} target="_blank" rel="noreferrer" style={{padding:"5px 9px",background:"#555",borderRadius:7,color:"#fff",fontSize:".7rem",flexShrink:0}}>Map</a>
        <button onClick={()=>setOpen(x=>!x)} style={{padding:"5px 9px",background:"var(--tm-surface2)",border:"none",borderRadius:7,color:"var(--tm-text)",fontSize:".7rem",fontFamily:"inherit",fontWeight:600,flexShrink:0}}>{open?"↑":"···"}</button>
      </div>
      {/* Expandable details */}
      {open&&<div style={{padding:"10px 14px 12px",borderTop:"1px solid #F0F4F7",background:"var(--tm-surface)",display:"flex",flexDirection:"column",gap:7}}>
        {act.address&&<div style={{fontSize:".76rem",color:"var(--tm-text2)"}}>📍 {act.address}</div>}
        {act.openHours&&<div style={{fontSize:".76rem",color:"var(--tm-text2)"}}>🕐 {act.openHours}</div>}
        {act.transport&&<div style={{padding:"8px 10px",background:"var(--tm-surface2)",border:"1px solid var(--tm-border)",borderRadius:8,fontSize:".75rem",color:"var(--tm-text)"}}><b>Getting there:</b> {act.transport}</div>}
        {act.tip&&<div style={{padding:"8px 10px",background:"var(--tm-bg)",border:"1px solid var(--tm-border)",borderRadius:8,fontSize:".75rem",color:"var(--tm-text2)"}}><b>Insider tip:</b> {act.tip}</div>}
      </div>}
    </div>
  );
}

// ── Hero Activity Card (magazine first-card) ──────────────────────────────────
function HeroActCard({act,onRemove,onZoom}){
  const [src,onImgErr]=useActivityPhoto(act.imgQuery,act.name);
  const [open,setOpen]=useState(false);
  const em=typeEmoji(act.type);
  const bookUrl="https://www.getyourguide.com/s/?q="+encodeURIComponent((act.name||"")+" "+(act.address||""));
  return(
    <div className="fu" style={{borderRadius:18,overflow:"hidden",marginBottom:14,position:"relative",boxShadow:"0 8px 32px rgba(47,65,86,.18)"}}>
      <div style={{height:240,position:"relative",background:"#111"}}>
        {src&&<img src={src} alt={act.name} loading="lazy" onError={onImgErr} style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/>}
        <div style={{position:"absolute",inset:0,background:"linear-gradient(to top,rgba(20,30,50,.92) 0%,rgba(20,30,50,.4) 50%,rgba(0,0,0,.1) 100%)"}}/>
        <button onClick={()=>onRemove(act._id||act.name)} style={{position:"absolute",top:12,right:12,width:32,height:32,borderRadius:"50%",background:"rgba(0,0,0,.45)",border:"1.5px solid rgba(255,255,255,.3)",color:"#fff",fontSize:"1rem",display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(4px)"}}>x</button>
        {act.isHidden&&<span style={{position:"absolute",top:12,left:12,fontSize:".62rem",padding:"3px 9px",background:"rgba(255,255,255,.15)",border:"1px solid rgba(255,255,255,.3)",borderRadius:50,color:"#fff",fontWeight:600}}>Hidden gem</span>}
        {act.conflict&&<span style={{position:"absolute",top:12,left:act.isHidden?120:12,fontSize:".62rem",padding:"3px 9px",background:"rgba(220,38,38,.7)",border:"1px solid rgba(255,255,255,.3)",borderRadius:50,color:"#fff",fontWeight:700}}>⚠ Time conflict</span>}
        {act.weatherWarning&&<span style={{position:"absolute",top:act.conflict?40:12,left:act.isHidden?120:12,fontSize:".62rem",padding:"3px 9px",background:"rgba(86,124,141,.85)",border:"1px solid rgba(255,255,255,.3)",borderRadius:50,color:"#fff",fontWeight:700}}>🌧 Rain risk</span>}
        <div style={{position:"absolute",bottom:0,left:0,right:0,padding:"18px 16px 16px"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,flexWrap:"wrap"}}>
            <span style={{background:"rgba(255,255,255,.18)",backdropFilter:"blur(6px)",border:"1px solid rgba(255,255,255,.25)",color:"#fff",borderRadius:50,padding:"3px 11px",fontSize:".72rem",fontWeight:700}}>{act.time||"--:--"}</span>
            <span style={{background:"rgba(255,255,255,.15)",border:"1px solid rgba(255,255,255,.2)",color:"#fff",borderRadius:50,padding:"3px 10px",fontSize:".72rem"}}>{em} {act.type||"Activity"}</span>
            {act.isFree
              ?<span style={{background:"rgba(86,124,141,.7)",borderRadius:50,padding:"3px 10px",fontSize:".72rem",color:"#fff",fontWeight:700}}>Free</span>
              :<span style={{background:"rgba(255,255,255,.15)",borderRadius:50,padding:"3px 10px",fontSize:".72rem",color:"#fff"}}>{act.price}</span>}
          </div>
          <h3 style={{fontSize:"1.45rem",fontWeight:900,color:"#fff",letterSpacing:"-.02em",lineHeight:1.15,marginBottom:4,textShadow:"0 2px 8px rgba(0,0,0,.4)"}}>{act.name}</h3>
          {act.desc&&<p style={{fontSize:".82rem",color:"rgba(255,255,255,.82)",lineHeight:1.5,margin:0}}>{act.desc}</p>}
        </div>
      </div>
      <div style={{background:"var(--tm-bg)",padding:"12px 14px",display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
        {act.duration&&<span className="tm-sm tm-c2">&#x23F1; {act.duration}</span>}
        {act.openHours&&<span className="tm-sm tm-c2">&#x1F550; {act.openHours}</span>}
        <div style={{flex:1}}/>
        {!act.isFree&&<a href={bookUrl} target="_blank" rel="noreferrer" style={{padding:"8px 14px",background:"#dc2626",borderRadius:8,color:"#fff",fontSize:".78rem",fontWeight:700}}>Book</a>}
        <button onClick={()=>setOpen(x=>!x)} style={{padding:"8px 14px",background:"var(--tm-surface2)",border:"none",borderRadius:8,color:"var(--tm-text)",fontSize:".78rem",fontFamily:"inherit",fontWeight:600}}>{open?"Less":"More"}</button>
        <a href={"https://www.google.com/maps/search/"+encodeURIComponent(act.name)} target="_blank" rel="noreferrer" style={{padding:"8px 12px",background:"#555",borderRadius:8,color:"#fff",fontSize:".78rem"}}>Map</a>
      </div>
      {open&&<div style={{background:"var(--tm-surface)",padding:"12px 14px",borderTop:"1px solid var(--tm-border)",display:"flex",flexDirection:"column",gap:8}}>
        {act.address&&<div style={{fontSize:".76rem",color:"var(--tm-text2)"}}>&#x1F4CD; {act.address}</div>}
        {act.transport&&<div style={{padding:"9px 12px",background:"var(--tm-surface2)",border:"1px solid var(--tm-border)",borderRadius:8,fontSize:".76rem",color:"var(--tm-text)"}}><b>Getting there:</b> {act.transport}</div>}
        {act.tip&&<div style={{padding:"9px 12px",background:"var(--tm-bg)",border:"1px solid var(--tm-border)",borderRadius:8,fontSize:".76rem",color:"var(--tm-text2)"}}><b>Insider tip:</b> {act.tip}</div>}
      </div>}
    </div>
  );
}

// ── Story Activity Card (horizontal swipeable) ─────────────────────────────────
function StoryActCard({act,onRemove,onZoom}){
  const [src,onImgErr]=useActivityPhoto(act.imgQuery,act.name);
  const [open,setOpen]=useState(false);
  const em=typeEmoji(act.type);
  const bookUrl="https://www.getyourguide.com/s/?q="+encodeURIComponent((act.name||"")+" "+(act.address||""));
  return(
    <div style={{flexShrink:0,width:200,borderRadius:16,overflow:"hidden",background:"var(--tm-bg)",boxShadow:"0 4px 20px rgba(47,65,86,.13)",border:"1px solid var(--tm-border)",display:"flex",flexDirection:"column",scrollSnapAlign:"start"}}>
      <div style={{height:140,position:"relative",background:"#111",flexShrink:0}}>
        {src&&<img src={src} alt={act.name} loading="lazy" onError={onImgErr} style={{width:"100%",height:"100%",objectFit:"cover"}}/>}
        <div style={{position:"absolute",inset:0,background:"linear-gradient(to top,rgba(20,30,50,.85) 0%,transparent 55%)"}}/>
        <button onClick={()=>onRemove(act._id||act.name)} style={{position:"absolute",top:8,right:8,width:26,height:26,borderRadius:"50%",background:"rgba(0,0,0,.4)",border:"1px solid rgba(255,255,255,.3)",color:"#fff",fontSize:".85rem",display:"flex",alignItems:"center",justifyContent:"center"}}>x</button>
        <div style={{position:"absolute",bottom:8,left:10,right:10}}>
          <div style={{fontSize:".6rem",fontWeight:700,color:"rgba(255,255,255,.75)",marginBottom:2}}>{em} {act.type}</div>
          <div style={{fontSize:".9rem",fontWeight:800,color:"#fff",lineHeight:1.2,overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>{act.name}</div>
        </div>
      </div>
      <div style={{padding:"10px 11px",flex:1,display:"flex",flexDirection:"column",gap:5}}>
        <div style={{display:"flex",gap:5,alignItems:"center",flexWrap:"wrap"}}>
          <span style={{background:act.conflict?"#dc2626":"#111",borderRadius:5,padding:"2px 7px",fontSize:".65rem",fontWeight:800,color:"#fff"}}>{act.time||"--:--"}</span>
          {act.duration&&<span style={{fontSize:".65rem",color:"var(--tm-text3)"}}>{act.duration}</span>}
          {act.conflict&&<span style={{fontSize:".6rem",color:"#dc2626",fontWeight:700}}>⚠</span>}
          {act.weatherWarning&&<span style={{fontSize:".6rem",color:"var(--tm-text2)",fontWeight:700}}>🌧</span>}
        </div>
        {act.desc&&<p style={{fontSize:".74rem",color:"var(--tm-text2)",lineHeight:1.45,margin:0,overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>{act.desc}</p>}
        {act.isFree?<span style={{fontSize:".68rem",fontWeight:700,color:"var(--tm-text2)"}}>Free</span>:<span style={{fontSize:".68rem",fontWeight:700,color:"var(--tm-text)"}}>{act.price}</span>}
        <div style={{marginTop:"auto",display:"flex",gap:6,paddingTop:4}}>
          {!act.isFree&&<a href={bookUrl} target="_blank" rel="noreferrer" style={{flex:1,padding:"6px 0",textAlign:"center",background:"#dc2626",borderRadius:7,color:"#fff",fontSize:".7rem",fontWeight:700}}>Book</a>}
          <button onClick={()=>setOpen(x=>!x)} style={{flex:1,padding:"6px 0",background:"var(--tm-surface2)",border:"none",borderRadius:7,color:"var(--tm-text)",fontSize:".7rem",fontFamily:"inherit",fontWeight:600}}>{open?"Less":"Info"}</button>
          <a href={"https://www.google.com/maps/search/"+encodeURIComponent(act.name)} target="_blank" rel="noreferrer" style={{padding:"6px 9px",background:"#555",borderRadius:7,color:"#fff",fontSize:".7rem"}}>Map</a>
        </div>
        {open&&<div style={{paddingTop:6,borderTop:"1px solid var(--tm-border)",display:"flex",flexDirection:"column",gap:4}}>
          {act.address&&<div style={{fontSize:".68rem",color:"var(--tm-text3)"}}>&#x1F4CD; {act.address}</div>}
          {act.transport&&<div style={{fontSize:".68rem",color:"var(--tm-text2)"}}>Bus: {act.transport}</div>}
          {act.tip&&<div style={{fontSize:".68rem",color:"var(--tm-text2)"}}>Tip: {act.tip}</div>}
          {act.openHours&&<div style={{fontSize:".68rem",color:"var(--tm-text3)"}}>{act.openHours}</div>}
        </div>}
      </div>
    </div>
  );
}

// ── Dining Row (editorial menu-style) ─────────────────────────────────────────
function DiningRow({lunch,dinner}){
  const [lOk,setLOk]=useState(true);
  const [dOk,setDOk]=useState(true);
  function MealEntry({meal,src,onErr,side}){
    if(!meal) return null;
    const restUrl="https://www.google.com/search?q="+encodeURIComponent(meal.name+" reserve table");
    return(
      <div style={{flex:1,display:"flex",gap:10,alignItems:"center",padding:"11px 12px",background:"var(--tm-bg)",borderRadius:12,border:"1px solid var(--tm-border)"}}>
        {src?<div style={{width:52,height:52,borderRadius:10,overflow:"hidden",flexShrink:0}}><img src={src} alt={meal.name} loading="lazy" onError={onErr} style={{width:"100%",height:"100%",objectFit:"cover"}}/></div>
          :<div style={{width:52,height:52,borderRadius:10,background:"var(--tm-surface2)",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.3rem"}}>{side==="lunch"?"☀️":"🌙"}</div>}
        <div style={{minWidth:0,flex:1}}>
          <div style={{fontSize:".58rem",fontWeight:700,textTransform:"uppercase",letterSpacing:".08em",color:"var(--tm-text3)",marginBottom:1}}>{side}</div>
          <div style={{fontSize:".85rem",fontWeight:700,color:"#2C365A",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{meal.name}</div>
          <div style={{fontSize:".7rem",color:"var(--tm-text2)",marginBottom:5}}>{meal.cuisine}{meal.price?" · "+meal.price:""}</div>
          <a href={restUrl} target="_blank" rel="noreferrer" style={{fontSize:".65rem",fontWeight:700,padding:"3px 9px",background:"#dc2626",borderRadius:5,color:"#fff"}}>Reserve</a>
        </div>
      </div>
    );
  }
  const lSrc=lOk&&lunch?actImg(lunch.imgQuery||lunch.name):null;
  const dSrc=dOk&&dinner?actImg(dinner.imgQuery||dinner.name):null;
  return(
    <div style={{marginBottom:16}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
        <div className="tm-flex1" style={{height:1,background:"var(--tm-surface2)"}}/>
        <span style={{fontSize:".65rem",fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",color:"var(--tm-text3)",padding:"0 4px"}}>Today's Dining</span>
        <div className="tm-flex1" style={{height:1,background:"var(--tm-surface2)"}}/>
      </div>
      <div className="tm-flex-col tm-gap8">
        <MealEntry meal={lunch} src={lSrc} onErr={()=>setLOk(false)} side="lunch"/>
        <MealEntry meal={dinner} src={dSrc} onErr={()=>setDOk(false)} side="dinner"/>
      </div>
    </div>
  );
}

// ── Add Modal ──────────────────────────────────────────────────────────────────
function AddModal({onClose,onAdd,destination,placesQuery,setPlacesQuery,placesResults,placesLoading,onRunPlacesSearch,onAddPlace}){
  const [mode,setMode]=useState("ai");
  const [actType,setActType]=useState("");
  const [loading,setLoading]=useState(false);
  const [name,setName]=useState(""); const [addr,setAddr]=useState("");
  const [time,setTime]=useState("10:00"); const [price,setPrice]=useState(""); const [desc,setDesc]=useState("");
  async function genAI(){
    if(!actType.trim()) return; setLoading(true);
    try{
      const p=`One ${actType} activity in ${destination}. Reply ONLY JSON no markdown no apostrophes: {"name":"","type":"","desc":"","address":"","duration":"","price":"","isFree":false,"isHidden":false,"bookingUrl":"","tip":"","transport":"","imgQuery":"","time":"10:00","openHours":""}`;
      const a=await callAI(p,400); onAdd({_id:uid(),...a}); onClose();
    }catch(e){ alert("Could not generate: "+e.message); } finally{ setLoading(false); }
  }
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:999,display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={onClose}>
      <div style={{background:"var(--tm-bg)",borderRadius:"18px 18px 0 0",padding:"20px 18px 32px",width:"100%",maxWidth:600,maxHeight:"88vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <h3 style={{fontSize:"1rem",fontWeight:800}}>Add Activity</h3>
          <button onClick={onClose} style={{background:"none",border:"none",fontSize:"1.4rem",color:"var(--tm-text3)"}}>×</button>
        </div>
        <div style={{display:"flex",gap:8,marginBottom:16}}>
          {[["ai","AI Generate"],["places","📍 Search Places"],["manual","Manual"]].map(([id,l])=>(
            <button key={id} onClick={()=>setMode(id)} style={{flex:1,padding:"10px",borderRadius:9,fontFamily:"inherit",fontSize:".82rem",fontWeight:700,background:mode===id?"#111":"var(--tm-border)",border:"1.5px solid "+(mode===id?"#111":"var(--tm-border)"),color:mode===id?"#fff":"#111",minHeight:44}}>{l}</button>
          ))}
        </div>
        {mode==="ai"&&<>
          <Lbl c="Type of activity"/>
          <div style={{display:"flex",flexWrap:"wrap",gap:7,marginBottom:12}}>
            {["Museum","Restaurant","Bar","Park","Viewpoint","Market","Beach","Castle","Nightclub","Cafe"].map(t=><Chip key={t} label={t} on={actType===t} onClick={()=>setActType(actType===t?"":t)}/>)}
          </div>
          <TIn value={actType} onChange={e=>setActType(e.target.value)} placeholder="Or describe: rooftop bar…" style={{marginBottom:14}}/>
          <Btn full onClick={genAI} disabled={!actType.trim()||loading} color="#111">
            {loading?<span style={{display:"flex",alignItems:"center",justifyContent:"center",gap:10}}><Spin size={18}/> Generating…</span>:"Generate Activity"}
          </Btn>
        </>}
        {mode==="places"&&<div style={{display:"flex",flexDirection:"column",gap:12}}>
          <Lbl c="Search for a place"/>
          <div className="tm-flex tm-gap8">
            <input value={placesQuery} onChange={e=>setPlacesQuery(e.target.value)} onKeyDown={e=>e.key==="Enter"&&onRunPlacesSearch()} placeholder="cafe, museum, park…" style={{flex:1,padding:"12px 13px",background:"var(--tm-surface2)",border:"1.5px solid var(--tm-border)",borderRadius:9,color:"var(--tm-text)",fontFamily:"inherit",fontSize:"16px"}}/>
            <button onClick={onRunPlacesSearch} disabled={placesLoading||!placesQuery.trim()} style={{padding:"12px 16px",borderRadius:9,background:"#111",color:"#fff",border:"none",fontWeight:700,fontSize:".85rem",fontFamily:"inherit",minHeight:44,opacity:placesLoading||!placesQuery.trim()?.5:1}}>
              {placesLoading?<Spin size={16}/>:"Search"}
            </button>
          </div>
          {placesResults.length>0&&<div style={{display:"flex",flexDirection:"column",gap:9}}>
            {placesResults.map(p=>(
              <div key={p._id} style={{padding:"12px 14px",background:"var(--tm-surface)",border:"1px solid var(--tm-border)",borderRadius:12,display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
                <div style={{minWidth:0,flex:1}}>
                  <div style={{fontWeight:700,fontSize:".9rem",color:"var(--tm-text)",marginBottom:2}}>{p.name}</div>
                  {p.address&&<div style={{fontSize:".72rem",color:"var(--tm-text3)",marginBottom:3}}>📍 {p.address}</div>}
                  <div className="tm-sm tm-c2">{p.desc}</div>
                  {p.openHours&&<div style={{fontSize:".68rem",color:"var(--tm-text3)",marginTop:3}}>🕐 {p.openHours.split("|")[0]}</div>}
                </div>
                <button onClick={()=>{onAddPlace(p);onClose();}} style={{flexShrink:0,padding:"8px 14px",borderRadius:9,background:"#555",color:"#fff",border:"none",fontWeight:700,fontSize:".78rem",fontFamily:"inherit",minHeight:36}}>+ Add</button>
              </div>
            ))}
          </div>}
          {!placesLoading&&placesResults.length===0&&placesQuery&&<div style={{textAlign:"center",fontSize:".8rem",color:"var(--tm-text3)",padding:"16px 0"}}>No results yet — press Search</div>}
        </div>}
        {mode==="manual"&&<div style={{display:"flex",flexDirection:"column",gap:11}}>
          <div><Lbl c="Name *"/><TIn value={name} onChange={e=>setName(e.target.value)} placeholder="Eiffel Tower"/></div>
          <div><Lbl c="Type"/><TIn value={actType} onChange={e=>setActType(e.target.value)} placeholder="Museum, Bar…"/></div>
          <div><Lbl c="Address"/><TIn value={addr} onChange={e=>setAddr(e.target.value)}/></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div><Lbl c="Time"/><TIn type="time" value={time} onChange={e=>setTime(e.target.value)}/></div>
            <div><Lbl c="Price"/><TIn value={price} onChange={e=>setPrice(e.target.value)} placeholder="Free / 15 EUR"/></div>
          </div>
          <div><Lbl c="Notes"/><textarea value={desc} onChange={e=>setDesc(e.target.value)} rows={2} style={{width:"100%",padding:"12px",background:"var(--tm-surface2)",border:"1.5px solid var(--tm-border)",borderRadius:9,fontFamily:"inherit"}}/></div>
          <Btn full onClick={()=>{ if(!name.trim()) return; onAdd({_id:uid(),name,type:actType||"Custom",desc,address:addr,time,price:price||"Free",isFree:!price||price.toLowerCase()==="free",duration:"",transport:"",bookingUrl:"",tip:"",isHidden:false,imgQuery:name+" "+destination}); onClose(); }} disabled={!name.trim()} color="#111">Add to Plan</Btn>
        </div>}
      </div>
    </div>
  );
}


// ── Export Modal ───────────────────────────────────────────────────────────────
function ExportModal({onClose,data,form,days}){
  const [copying,setCopying]=useState(false);
  async function handleCopy(){
    setCopying(true);
    try{ await navigator.clipboard.writeText(buildTripText(data,form,days)); alert(T("copiedClipboard")); }
    catch(_){ alert(T("couldNotCopy")); }
    finally{ setCopying(false); }
  }
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:999,display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={onClose}>
      <div style={{background:"var(--tm-bg)",borderRadius:"18px 18px 0 0",padding:"20px 18px 32px",width:"100%",maxWidth:600}} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
          <h3 style={{fontSize:"1rem",fontWeight:800,color:"var(--tm-text)"}}>Export Trip</h3>
          <button onClick={onClose} style={{background:"none",border:"none",fontSize:"1.4rem",color:"var(--tm-text3)"}}>×</button>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <button onClick={()=>{ downloadTextFile(`${data.destination.replace(/\s+/g,"-")}-tripmind.txt`, buildTripText(data,form,days)); onClose(); }}
            style={{display:"flex",alignItems:"center",gap:12,padding:"14px 16px",borderRadius:12,border:"1.5px solid var(--tm-border)",background:"var(--tm-surface)",textAlign:"left",cursor:"pointer",fontFamily:"inherit"}}>
            <span className="tm-4xl">📄</span>
            <div><div style={{fontWeight:700,fontSize:".9rem",color:"var(--tm-text)"}}>Download .txt</div><div className="tm-sm tm-c3 tm-mt4" style={{fontSize:".73rem"}}>Save your itinerary as a plain text file</div></div>
          </button>
          <button onClick={()=>{ exportTripAsPrintableHTML(data,form,days); onClose(); }}
            style={{display:"flex",alignItems:"center",gap:12,padding:"14px 16px",borderRadius:12,border:"1.5px solid var(--tm-border)",background:"var(--tm-surface)",textAlign:"left",cursor:"pointer",fontFamily:"inherit"}}>
            <span className="tm-4xl">🖨️</span>
            <div><div style={{fontWeight:700,fontSize:".9rem",color:"var(--tm-text)"}}>Print / Save as PDF</div><div className="tm-sm tm-c3 tm-mt4" style={{fontSize:".73rem"}}>Opens a print-ready page in a new tab</div></div>
          </button>
          <button onClick={handleCopy} disabled={copying}
            style={{display:"flex",alignItems:"center",gap:12,padding:"14px 16px",borderRadius:12,border:"1.5px solid var(--tm-border)",background:"var(--tm-surface)",textAlign:"left",cursor:"pointer",fontFamily:"inherit",opacity:copying?.6:1}}>
            <span className="tm-4xl">📋</span>
            <div><div style={{fontWeight:700,fontSize:".9rem",color:"var(--tm-text)"}}>Copy as Text</div><div className="tm-sm tm-c3 tm-mt4" style={{fontSize:".73rem"}}>Copy the full itinerary to clipboard</div></div>
          </button>
          <button onClick={async()=>{ try{ await shareTripText(data,form,days); onClose(); }catch(_){} }}
            style={{display:"flex",alignItems:"center",gap:12,padding:"14px 16px",borderRadius:12,border:"1.5px solid var(--tm-border)",background:"var(--tm-surface)",textAlign:"left",cursor:"pointer",fontFamily:"inherit"}}>
            <span className="tm-4xl">📤</span>
            <div><div style={{fontWeight:700,fontSize:".9rem",color:"var(--tm-text)"}}>Share via App</div><div className="tm-sm tm-c3 tm-mt4" style={{fontSize:".73rem"}}>Use your phone's share sheet (iOS/Android)</div></div>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── API Key Card (own component — required by Rules of Hooks) ──────────────────
function ApiKeyCard(){
  const [k,setK]=useState(()=>{try{return localStorage.getItem("tm_api_key")||"";}catch(_){return "";}});
  const save=(val)=>{setK(val);try{localStorage.setItem("tm_api_key",val);}catch(_){}};
  return(
    <div style={{background:"var(--tm-bg)",border:"1px solid var(--tm-border)",borderRadius:14,padding:"14px 16px",marginBottom:14}}>
      <div style={{fontWeight:800,fontSize:".88rem",marginBottom:6}}>🔑 Claude API Key</div>
      <div style={{fontSize:".72rem",color:"var(--tm-text3)",marginBottom:8}}>Required to generate trips. Get yours at console.anthropic.com</div>
      <input type="password" value={k} onChange={e=>save(e.target.value)} placeholder="sk-ant-…" style={{width:"100%",padding:"9px 11px",borderRadius:8,border:`1.5px solid ${k?"#555":"var(--tm-border)"}`,fontSize:".78rem",background:"var(--tm-surface2)",fontFamily:"inherit"}}/>
      {k&&<div style={{fontSize:".65rem",color:"var(--tm-text2)",marginTop:5}}>✓ Key saved — stored only in this browser</div>}
    </div>
  );
}

// ── Settings Card (Supabase sync only — API key lives on server, not here) ─────
function SbConfigCard(){
  const [open,setOpen]=useState(false);
  const [url,setUrl]=useState(()=>{ try{ return localStorage.getItem("tm_sb_url")||""; }catch(_){ return ""; } });
  const [sbKey,setSbKey]=useState(()=>{ try{ return localStorage.getItem("tm_sb_key")||""; }catch(_){ return ""; } });
  const [saved,setSaved]=useState(false);
  const connected=!!(url&&sbKey);
  function save(){
    try{
      localStorage.setItem("tm_sb_url",url.trim());
      localStorage.setItem("tm_sb_key",sbKey.trim());
    }catch(_){}
    setSaved(true);
    setTimeout(()=>setSaved(false),2500);
    setOpen(false);
  }
  function clear(){
    try{ localStorage.removeItem("tm_sb_url"); localStorage.removeItem("tm_sb_key"); }catch(_){}
    setUrl(""); setSbKey("");
  }
  return(
    <div style={{marginBottom:12,border:"1px solid var(--tm-border)",borderRadius:14,overflow:"hidden",background:"var(--tm-bg)"}}>
      <button onClick={()=>setOpen(x=>!x)} style={{width:"100%",padding:"13px 16px",background:"none",border:"none",display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer",fontFamily:"inherit"}}>
        <div style={{display:"flex",alignItems:"center",gap:9}}>
          <div style={{width:8,height:8,borderRadius:"50%",background:"#555",flexShrink:0}}/>
          <div style={{textAlign:"left"}}>
            <div style={{fontSize:".82rem",fontWeight:700,color:"var(--tm-text)"}}>⚙️ Settings</div>
            <div style={{fontSize:".67rem",color:"var(--tm-text3)",marginTop:1}}>
              {connected?T("realTimeSync"):T("syncSub")}
            </div>
          </div>
        </div>
        <span style={{fontSize:".75rem",color:"var(--tm-text3)",transform:open?"rotate(180deg)":"none",transition:"transform .2s"}}>▼</span>
      </button>
      {open&&<div style={{padding:"0 16px 16px",borderTop:"1px solid var(--tm-border)",display:"flex",flexDirection:"column",gap:10}}>
        <div style={{paddingTop:10}}>
          <div style={{fontSize:".7rem",fontWeight:700,color:"var(--tm-text)",marginBottom:6}}>☁️ Real-time Sync (optional)</div>
          <div style={{fontSize:".72rem",color:"var(--tm-text2)",lineHeight:1.5,marginBottom:8}}>
            Create a free project at <b>supabase.com</b>, add a <code>trips</code> table with <code>id</code> (text), <code>days</code> (jsonb), <code>updated_at</code> (timestamp) to sync your plan with travel companions in real time.
          </div>
          <div className="tm-flex-col tm-gap8">
            <input value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://xxxx.supabase.co" style={{width:"100%",padding:"9px 11px",borderRadius:8,border:"1.5px solid var(--tm-border)",fontSize:".78rem",background:"var(--tm-surface2)",fontFamily:"inherit"}}/>
            <input value={sbKey} onChange={e=>setSbKey(e.target.value)} type="password" placeholder="Supabase anon key (eyJhb…)" style={{width:"100%",padding:"9px 11px",borderRadius:8,border:"1.5px solid var(--tm-border)",fontSize:".78rem",background:"var(--tm-surface2)",fontFamily:"inherit"}}/>
          </div>
        </div>
        <div style={{display:"flex",gap:7}}>
          <button onClick={save} style={{flex:1,padding:"9px",borderRadius:9,background:"#111",color:"#fff",border:"none",fontSize:".78rem",fontWeight:700,fontFamily:"inherit"}}>
            {saved?T("saved"):T("saveTxt")}
          </button>
          {connected&&<button onClick={clear} style={{padding:"9px 13px",borderRadius:9,background:"var(--tm-surface2)",color:"var(--tm-text3)",border:"1px solid var(--tm-border)",fontSize:".78rem",fontFamily:"inherit"}}>Clear Sync</button>}
        </div>
      </div>}
    </div>
  );
}

// ── Setup ──────────────────────────────────────────────────────────────────────
function Setup({onGenerate,savedTrips,setSavedTrips,onLoadTrip,initialDest="",onBack}){
  const [form,setForm]=useState({destination:initialDest,hotel:"",startDate:"",endDate:"",arrivalTime:"",departureTime:"",travelers:2,ageGroup:"26-40",style:"medium",transport:"mixed",interests:[],notes:""});
  const set=(k,v)=>setForm(p=>({...p,[k]:v}));
  const toggleI=i=>set("interests",form.interests.includes(i)?form.interests.filter(x=>x!==i):[...form.interests,i]);
  // Sync destination when navigated from quick-start
  useEffect(()=>{ if(initialDest) setForm(p=>({...p,destination:initialDest})); },[initialDest]);
  const days=getDays(form.startDate,form.endDate);
  const lang=getLang();
  const T=(k)=>t(lang,k);
  const inp={width:"100%",padding:"13px 14px",background:"var(--tm-bg)",border:"1.5px solid var(--tm-border)",borderRadius:10,color:"var(--tm-text)",fontFamily:"inherit",fontSize:".9rem",outline:"none",boxSizing:"border-box"};
  const secLabel={fontSize:".6rem",fontWeight:800,letterSpacing:".14em",textTransform:"uppercase",color:"var(--tm-text)",marginBottom:10};
  const secTitle={fontSize:"1rem",fontWeight:700,color:"var(--tm-text)",marginBottom:4};
  const card={background:"var(--tm-bg)",border:"1px solid var(--tm-border)",borderRadius:16,padding:"20px 18px",marginBottom:12};
  return(
    <div style={{minHeight:"100vh",background:"var(--tm-surface)",fontFamily:"inherit",paddingBottom:100}}>
      <style>{CSS}</style>

      {/* ── HEADER ── */}
      <div style={{background:"var(--tm-bg)",borderBottom:"1px solid var(--tm-border)",padding:"52px 20px 18px",position:"sticky",top:0,zIndex:50}}>
        <div style={{maxWidth:600,margin:"0 auto",display:"flex",alignItems:"center",gap:14}}>
          {onBack&&<button onClick={onBack} style={{background:"none",border:"none",cursor:"pointer",padding:"4px 0",fontFamily:"inherit",fontSize:"1.1rem",color:"var(--tm-text)",lineHeight:1,flexShrink:0}}>←</button>}
          <div style={{flex:1}}>
            <div style={{fontSize:".6rem",fontWeight:800,letterSpacing:".14em",textTransform:"uppercase",color:"var(--tm-text)",marginBottom:3}}>TripMind</div>
            <div style={{fontSize:"1.25rem",fontWeight:900,color:"var(--tm-text)",letterSpacing:"-.03em",lineHeight:1}}>{T("planNewTrip")}</div>
          </div>
        </div>
      </div>

      <div style={{maxWidth:600,margin:"0 auto",padding:"18px 16px 80px"}}>

        {/* Destination & Hotel */}
        <div style={card}>
          <div style={secLabel}>Where</div>
          <input value={form.destination} onChange={e=>set("destination",e.target.value)} placeholder="Paris, Tokyo, Bali…" style={inp}/>
          <div style={{height:10}}/>
          <input value={form.hotel} onChange={e=>set("hotel",e.target.value)} placeholder="Hotel or area (optional)" style={inp}/>
          <div style={{marginTop:7,fontSize:".73rem",color:"var(--tm-text)"}}>{T("hotelSub")}</div>
        </div>

        {/* Dates */}
        <div style={card}>
          <div style={secLabel}>When</div>
          <div className="tm-flex tm-gap10">
            <div style={{flex:1}}>
              <div className="tm-sm tm-c1 tm-mb6" style={{fontWeight:600}}>Arrival</div>
              <input type="date" value={form.startDate} onChange={e=>set("startDate",e.target.value)} style={inp}/>
            </div>
            <div style={{flex:1}}>
              <div className="tm-sm tm-c1 tm-mb6" style={{fontWeight:600}}>Departure</div>
              <input type="date" value={form.endDate} onChange={e=>set("endDate",e.target.value)} style={inp}/>
            </div>
          </div>
          {days>0&&<div style={{marginTop:10,padding:"9px 13px",background:"var(--tm-surface)",border:"1px solid var(--tm-border)",borderRadius:9,fontSize:".84rem",color:"var(--tm-text)",fontWeight:600}}>{days} day{days!==1?"s":""} · {fmtDate(form.startDate)} → {fmtDate(form.endDate)}{days>7?" (generated in weekly batches)":""}</div>}
        </div>

        {/* Flight times */}
        <div style={card}>
          <div style={secLabel}>Flight Times</div>
          <div style={{fontSize:".78rem",color:"var(--tm-text)",marginBottom:12}}>{T("flightSub")}</div>
          <div className="tm-flex tm-gap10">
            <div style={{flex:1}}>
              <div className="tm-sm tm-c1 tm-mb6" style={{fontWeight:600}}>Arrival time</div>
              <input type="time" value={form.arrivalTime} onChange={e=>set("arrivalTime",e.target.value)} style={inp}/>
            </div>
            <div style={{flex:1}}>
              <div className="tm-sm tm-c1 tm-mb6" style={{fontWeight:600}}>Departure time</div>
              <input type="time" value={form.departureTime} onChange={e=>set("departureTime",e.target.value)} style={inp}/>
            </div>
          </div>
          {form.arrivalTime&&<div style={{marginTop:8,fontSize:".75rem",color:"var(--tm-text)"}}>Day 1 starts from {form.arrivalTime}</div>}
          {form.departureTime&&<div style={{marginTop:4,fontSize:".75rem",color:"var(--tm-text)"}}>Last day ends by {fmtTime((toMins(form.departureTime)||0)-120)}</div>}
        </div>

        {/* Travelers */}
        <div style={card}>
          <div style={secLabel}>Travelers</div>
          <div style={{display:"flex",alignItems:"center",gap:20,marginBottom:16}}>
            <button onClick={()=>set("travelers",Math.max(1,form.travelers-1))} style={{width:40,height:40,borderRadius:10,background:"var(--tm-surface)",border:"1px solid var(--tm-border)",color:"var(--tm-text)",fontSize:"1.3rem",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontFamily:"inherit"}}>−</button>
            <span style={{fontSize:"1.6rem",fontWeight:900,color:"var(--tm-text)",minWidth:28,textAlign:"center"}}>{form.travelers}</span>
            <button onClick={()=>set("travelers",Math.min(30,form.travelers+1))} style={{width:40,height:40,borderRadius:10,background:"var(--tm-surface)",border:"1px solid var(--tm-border)",color:"var(--tm-text)",fontSize:"1.3rem",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontFamily:"inherit"}}>+</button>
          </div>
          <div style={{fontSize:".72rem",color:"var(--tm-text)",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:8}}>Age group</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
            {AGE_GROUPS.map(a=>(
              <button key={a} onClick={()=>set("ageGroup",a)} style={{padding:"8px 14px",borderRadius:50,fontSize:".8rem",fontFamily:"inherit",cursor:"pointer",background:form.ageGroup===a?"#111":"#fff",border:"1.5px solid "+(form.ageGroup===a?"#111":"var(--tm-border2)"),color:form.ageGroup===a?"#fff":"#111",transition:"all .15s",fontWeight:form.ageGroup===a?700:500}}>{a}</button>
            ))}
          </div>
        </div>

        {/* Travel style */}
        <div style={card}>
          <div style={secLabel}>Travel Style</div>
          <div className="tm-flex-col tm-gap8">
            {[{id:"budget",l:"Budget",s:"Hostels, street food, free sights"},{id:"medium",l:"Comfort",s:"Mid-range hotels, mix of dining"},{id:"luxury",l:"Luxury",s:"5-star hotels, fine dining, VIP"}].map(x=>(
              <button key={x.id} onClick={()=>set("style",x.id)} style={{padding:"13px 15px",borderRadius:11,fontFamily:"inherit",textAlign:"left",background:form.style===x.id?"#111":"#fff",border:"1.5px solid "+(form.style===x.id?"#111":"var(--tm-border)"),cursor:"pointer",transition:"all .15s"}}>
                <div style={{fontSize:".9rem",fontWeight:700,color:form.style===x.id?"#fff":"#111"}}>{x.l}</div>
                <div style={{fontSize:".75rem",color:form.style===x.id?"rgba(255,255,255,.7)":"#111",marginTop:2}}>{x.s}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Transport */}
        <div style={card}>
          <div style={secLabel}>Transport</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
            {[{id:"public",l:"Public"},{id:"car",l:"Car"},{id:"walking",l:"Walking"},{id:"mixed",l:"Mixed"}].map(x=>(
              <button key={x.id} onClick={()=>set("transport",x.id)} style={{padding:"8px 16px",borderRadius:50,fontSize:".8rem",fontFamily:"inherit",cursor:"pointer",background:form.transport===x.id?"#111":"#fff",border:"1.5px solid "+(form.transport===x.id?"#111":"var(--tm-border2)"),color:form.transport===x.id?"#fff":"#111",transition:"all .15s",fontWeight:form.transport===x.id?700:500}}>{x.l}</button>
            ))}
          </div>
        </div>

        {/* Interests */}
        <div style={card}>
          <div style={secLabel}>Interests</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
            {INTERESTS.map(i=>(
              <button key={i} onClick={()=>toggleI(i)} style={{padding:"8px 14px",borderRadius:50,fontSize:".8rem",fontFamily:"inherit",cursor:"pointer",background:form.interests.includes(i)?"#111":"#fff",border:"1.5px solid "+(form.interests.includes(i)?"#111":"var(--tm-border2)"),color:form.interests.includes(i)?"#fff":"#111",transition:"all .15s",fontWeight:form.interests.includes(i)?700:500}}>{i}</button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div style={card}>
          <div style={secLabel}>Notes</div>
          <textarea value={form.notes} onChange={e=>set("notes",e.target.value)} rows={3} placeholder={T("notesPlaceholder")} style={{...inp,resize:"none",lineHeight:1.6}}/>
        </div>

        <NotifSetupCard/>

        {/* Generate button */}
        <button onClick={()=>form.destination.trim()&&onGenerate(form)} disabled={!form.destination.trim()}
          style={{width:"100%",padding:"16px",borderRadius:14,border:"none",fontFamily:"inherit",fontSize:"1rem",fontWeight:800,cursor:form.destination.trim()?"pointer":"default",background:form.destination.trim()?"#111":"var(--tm-border2)",color:form.destination.trim()?"#fff":"#bbb",letterSpacing:"-.01em",transition:"all .18s",marginTop:4}}>
          {form.destination.trim()?T("generate"):T("enterDest")}
        </button>
      </div>
    </div>
  );
}

// ── Loading ────────────────────────────────────────────────────────────────────
function Loading({msg,pct}){
  // Parse "Days ready: X / Y" for the grid if present
  const gridMatch=msg&&msg.match(/Days ready:\s*(\d+)\s*\/\s*(\d+)/);
  const doneDays=gridMatch?parseInt(gridMatch[1]):null;
  const totalDaysLoading=gridMatch?parseInt(gridMatch[2]):null;
  return(
    <div style={{minHeight:"100vh",background:"#111",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:"inherit",gap:20,padding:28}}>
      <style>{CSS}</style>
      <div style={{fontSize:"3.2rem",animation:"pulse 2s infinite"}}>🗺️</div>
      <div style={{fontSize:"1.25rem",fontWeight:900,textAlign:"center",color:"#fff",letterSpacing:"-.01em"}}>Building Your Trip</div>
      <div style={{fontSize:".84rem",color:"var(--tm-border)",maxWidth:300,textAlign:"center",lineHeight:1.6,minHeight:38}}>{msg}</div>
      {/* Progress bar */}
      <div style={{width:"100%",maxWidth:300}}>
        <div style={{background:"rgba(200,217,230,.2)",borderRadius:50,height:6,overflow:"hidden"}}>
          <div style={{height:"100%",background:"var(--tm-surface2)",borderRadius:50,width:pct+"%",transition:"width .35s ease"}}/>
        </div>
        <div style={{textAlign:"center",fontSize:".72rem",color:"var(--tm-text3)",marginTop:5}}>{Math.round(pct)}%</div>
      </div>
      {/* Per-day grid — shows once parallel generation starts */}
      {totalDaysLoading&&<div style={{display:"flex",flexWrap:"wrap",gap:6,justifyContent:"center",maxWidth:320}}>
        {Array.from({length:totalDaysLoading},(_,i)=>{
          const done=i<doneDays;
          return(
            <div key={i} style={{width:36,height:36,borderRadius:10,background:done?"#555":"rgba(200,217,230,.12)",border:"1.5px solid "+(done?"var(--tm-border)":"rgba(200,217,230,.2)"),display:"flex",alignItems:"center",justifyContent:"center",fontSize:".65rem",fontWeight:700,color:done?"#fff":"rgba(200,217,230,.35)",transition:"all .3s"}}>
              {done?"✓":"D"+(i+1)}
            </div>
          );
        })}
      </div>}
      {!totalDaysLoading&&<Spin size={26}/>}
    </div>
  );
}


// ── Dynamic Trip Engine (inlined) ─────────────────────────────────────────────
function optimizeDayPlan(day,form,totalDays){
  const dayStart=getDayStart(day,form);
  const dayEnd=getDayEnd(day,form,totalDays);
  const normalized=(day.activities||[]).map(normalizeActivity);
  const prioritized=prioritizeActivities(normalized,day.weatherForecast,dayStart,dayEnd);
  const timed=assignTimes(prioritized,dayStart,dayEnd);
  return{
    ...day,
    activities:timed.map(({_engine,...rest})=>rest),
    engineMeta:{optimizedAt:new Date().toISOString(),weatherMode:weatherLooksRainy(day.weatherForecast)?"rain-adjusted":"normal",dayStart:fmtTime(dayStart),dayEnd:fmtTime(dayEnd)}
  };
}
function optimizeWholeTrip(days,form){
  return (days||[]).map(day=>optimizeDayPlan(day,form,days.length));
}
function replaceOutdoorForRain(day,indoorFallbacks=[]){
  if(!weatherLooksRainy(day?.weatherForecast)) return day;
  let fi=0;
  return{...day,activities:(day.activities||[]).map(act=>{
    if(!isOutdoorActivity(act)||act.locked) return act;
    const rep=indoorFallbacks[fi++];
    if(!rep) return{...act,weatherWarning:"Outdoor activity on rainy day"};
    return{...rep,_id:act._id,replacedOriginal:act.name,weatherReplacement:true};
  })};
}
function markActivityLocked(day,activityId,locked=true){
  return{...day,activities:(day.activities||[]).map(a=>(a._id||a.name)===activityId?{...a,locked}:a)};
}


// ── Group Planning Engine v2 (inlined — uid() from global scope, no exports) ───
function safeName(name){ return String(name||"").trim(); }
function scoreVotes(votes={}){ return Object.values(votes).reduce((sum,v)=>sum+Number(v||0),0); }
function voterStats(votes={}){ const arr=Object.values(votes); return{up:arr.filter(v=>Number(v)===1).length,down:arr.filter(v=>Number(v)===-1).length,score:scoreVotes(votes)}; }

function createInitialGroupState(initialMembers=[]){
  return{
    members:initialMembers.length>0
      ?initialMembers.map(m=>({id:m.id||uid(),name:safeName(m.name)||"Traveler",role:m.role||"member"}))
      :[{id:"u1",name:"Laura",role:"owner"}],
    suggestionsByDay:{},
    commentsBySuggestionId:{},
    activityVotesByDay:{}
  };
}
function addGroupMember(state,memberName,role="member"){
  const name=safeName(memberName); if(!name) return state;
  const exists=state.members.some(m=>m.name.toLowerCase()===name.toLowerCase());
  if(exists) return state;
  return{...state,members:[...state.members,{id:uid(),name,role}]};
}
function removeGroupMember(state,memberId){
  return{...state,members:state.members.filter(m=>m.id!==memberId)};
}
function createSuggestion({dayNumber,createdBy,title,type,notes,activityData}){
  return{id:uid(),dayNumber,createdBy,title:safeName(title)||"Suggestion",type:safeName(type)||"Activity",notes:String(notes||"").trim(),status:"pending",votes:{},createdAt:new Date().toISOString(),activityData:activityData||null};
}
function addSuggestion(state,payload){
  const suggestion=createSuggestion(payload);
  const dayKey=String(payload.dayNumber);
  return{...state,suggestionsByDay:{...state.suggestionsByDay,[dayKey]:[...(state.suggestionsByDay[dayKey]||[]),suggestion]}};
}
function updateSuggestionVote(state,dayNumber,suggestionId,memberId,value){
  const dayKey=String(dayNumber); const normalized=value===-1?-1:1;
  return{...state,suggestionsByDay:{...state.suggestionsByDay,[dayKey]:(state.suggestionsByDay[dayKey]||[]).map(s=>s.id!==suggestionId?s:{...s,votes:{...s.votes,[memberId]:normalized}})}};
}
function clearSuggestionVote(state,dayNumber,suggestionId,memberId){
  const dayKey=String(dayNumber);
  return{...state,suggestionsByDay:{...state.suggestionsByDay,[dayKey]:(state.suggestionsByDay[dayKey]||[]).map(s=>{
    if(s.id!==suggestionId) return s;
    const nv={...s.votes}; delete nv[memberId]; return{...s,votes:nv};
  })}};
}
function setSuggestionStatus(state,dayNumber,suggestionId,status){
  const dayKey=String(dayNumber);
  const nextStatus=["approved","rejected","pending"].includes(status)?status:"pending";
  return{...state,suggestionsByDay:{...state.suggestionsByDay,[dayKey]:(state.suggestionsByDay[dayKey]||[]).map(s=>s.id!==suggestionId?s:{...s,status:nextStatus})}};
}
function deleteSuggestion(state,dayNumber,suggestionId){
  const dayKey=String(dayNumber);
  const nextComments={...state.commentsBySuggestionId}; delete nextComments[suggestionId];
  return{...state,suggestionsByDay:{...state.suggestionsByDay,[dayKey]:(state.suggestionsByDay[dayKey]||[]).filter(s=>s.id!==suggestionId)},commentsBySuggestionId:nextComments};
}
function addSuggestionComment(state,suggestionId,memberId,text){
  const clean=String(text||"").trim(); if(!clean) return state;
  return{...state,commentsBySuggestionId:{...state.commentsBySuggestionId,[suggestionId]:[...(state.commentsBySuggestionId[suggestionId]||[]),{id:uid(),memberId,text:clean,createdAt:new Date().toISOString()}]}};
}
function voteOnExistingActivity(state,dayNumber,activityId,memberId,value){
  const dayKey=String(dayNumber); const normalized=value===-1?-1:1;
  return{...state,activityVotesByDay:{...state.activityVotesByDay,[dayKey]:{...(state.activityVotesByDay[dayKey]||{}),[activityId]:{...((state.activityVotesByDay[dayKey]||{})[activityId]||{}),[memberId]:normalized}}}};
}
function getSuggestionsForDay(state,dayNumber){
  const dayKey=String(dayNumber);
  return [...(state.suggestionsByDay[dayKey]||[])].sort((a,b)=>{
    const sr={approved:3,pending:2,rejected:1};
    if(sr[b.status]!==sr[a.status]) return sr[b.status]-sr[a.status];
    const as=voterStats(a.votes).score, bs=voterStats(b.votes).score;
    if(bs!==as) return bs-as;
    return new Date(a.createdAt)-new Date(b.createdAt);
  });
}
function getApprovedSuggestionsForDay(state,dayNumber){
  return getSuggestionsForDay(state,dayNumber).filter(s=>s.status==="approved");
}
function getTopSuggestedActivities(state,dayNumber,minScore=1){
  return getSuggestionsForDay(state,dayNumber).filter(s=>voterStats(s.votes).score>=minScore);
}
function mergeApprovedSuggestionsIntoActivities(day,state){
  const approved=getApprovedSuggestionsForDay(state,day.day).filter(s=>s.activityData).map(s=>({_id:s.id,...s.activityData,groupApproved:true,groupSuggestionTitle:s.title}));
  if(!approved.length) return day;
  return{...day,activities:[...(day.activities||[]),...approved]};
}
function autoApproveTopSuggestions(state,dayNumber,threshold=2){
  const dayKey=String(dayNumber);
  return{...state,suggestionsByDay:{...state.suggestionsByDay,[dayKey]:(state.suggestionsByDay[dayKey]||[]).map(s=>{
    const stats=voterStats(s.votes);
    return stats.score>=threshold&&s.status==="pending"?{...s,status:"approved"}:s;
  })}};
}
function buildSuggestionActivityData({title,type,notes,destination}){
  return{name:title,type:type||"Activity",desc:notes||"",duration:"1h 30m",time:"18:00",price:"Free",isFree:true,address:"",transport:"",tip:"",imgQuery:(title+" "+(destination||"")).trim()};
}
function getMemberName(state,memberId){
  return (state.members.find(m=>m.id===memberId)||{}).name||"Unknown";
}
function getActivityVoteScore(state,dayNumber,activityId){
  const dayVotes=(state.activityVotesByDay[String(dayNumber)]||{});
  return scoreVotes(dayVotes[activityId]||{});
}


// ── Supabase config (user-configurable via localStorage) ──────────────────────
// Set SUPABASE_URL + SUPABASE_KEY in localStorage under "tm_sb_url" / "tm_sb_key"
// to enable real-time sync. App works fully offline without these.
function getSbConfig(){
  try{
    return{
      url:localStorage.getItem("tm_sb_url")||"",
      key:localStorage.getItem("tm_sb_key")||""
    };
  }catch(_){ return{url:"",key:""}; }
}
function sbHeaders(key){ return{"apikey":key,"Authorization":"Bearer "+key,"Content-Type":"application/json","Prefer":"return=minimal"}; }

// ── useTripSync: optimistic local + cloud sync + real-time subscription ───────
function useTripSync(tripId,initialDays){
  const [days,setDays]=useState(initialDays);
  const [syncStatus,setSyncStatus]=useState("idle"); // idle|syncing|synced|error|offline
  const [syncError,setSyncError]=useState("");
  const realtimeRef=useRef(null);
  const {url:sbUrl,key:sbKey}=getSbConfig();
  const cloudEnabled=!!(sbUrl&&sbKey&&tripId);

  // ── push full days array to Supabase ──────────────────────────────────────
  async function pushToCloud(newDays){
    if(!cloudEnabled){setSyncStatus("offline");return;}
    setSyncStatus("syncing");
    try{
      const res=await fetch(`${sbUrl}/rest/v1/trips?id=eq.${encodeURIComponent(tripId)}`,{
        method:"PATCH",
        headers:sbHeaders(sbKey),
        body:JSON.stringify({days:newDays,updated_at:new Date().toISOString()})
      });
      if(!res.ok) throw new Error("HTTP "+res.status);
      setSyncStatus("synced");
      setTimeout(()=>setSyncStatus("idle"),2500);
    }catch(e){
      setSyncStatus("error");
      setSyncError(e.message);
      setTimeout(()=>setSyncStatus("idle"),5000);
    }
  }

  // ── subscribe to real-time changes from Supabase Realtime ────────────────
  useEffect(()=>{
    if(!cloudEnabled) return;
    // Use Supabase Realtime v2 REST-based long-poll (no WS library needed)
    let active=true;
    let etag="";
    async function poll(){
      try{
        const res=await fetch(`${sbUrl}/rest/v1/trips?id=eq.${encodeURIComponent(tripId)}&select=days,updated_at`,{
          headers:{...sbHeaders(sbKey),"If-None-Match":etag}
        });
        if(res.status===304){/* no change */}
        else if(res.ok){
          etag=res.headers.get("etag")||"";
          const rows=await res.json();
          if(rows[0]?.days){
            setDays(rows[0].days.map(d=>({...d,activities:(d.activities||[]).map(a=>({_id:a._id||uid(),...a}))})));
          }
        }
      }catch(_){}
      if(active) realtimeRef.current=setTimeout(poll,8000); // poll every 8s
    }
    realtimeRef.current=setTimeout(poll,3000); // first poll after 3s
    return()=>{ active=false; clearTimeout(realtimeRef.current); };
  },[cloudEnabled,tripId]);

  // ── wrapped mutators: optimistic update → push → rollback on fail ─────────
  function mutate(updaterFn){
    setDays(prev=>{
      const next=updaterFn(prev);
      pushToCloud(next).catch(()=>{});
      return next;
    });
  }

  function addActivity(dayIdx,act){
    mutate(prev=>prev.map((d,i)=>i!==dayIdx?d:{...d,activities:[...d.activities,act]}));
  }
  function removeActivity(dayIdx,actId){
    mutate(prev=>prev.map((d,i)=>i!==dayIdx?d:{...d,activities:d.activities.filter(a=>(a._id||a.name)!==actId)}));
  }
  function reorderActivities(dayIdx,fromIdx,toIdx){
    if(fromIdx===toIdx) return;
    mutate(prev=>prev.map((d,i)=>{
      if(i!==dayIdx) return d;
      const arr=[...d.activities];
      const [moved]=arr.splice(fromIdx,1);
      arr.splice(toIdx,0,moved);
      return{...d,activities:arr};
    }));
  }
  function moveActivityToDay(fromDayIdx,actId,toDayIdx){
    if(fromDayIdx===toDayIdx) return;
    mutate(prev=>{
      const act=prev[fromDayIdx]?.activities?.find(a=>(a._id||a.name)===actId);
      if(!act) return prev;
      return prev.map((d,i)=>{
        if(i===fromDayIdx) return{...d,activities:d.activities.filter(a=>(a._id||a.name)!==actId)};
        if(i===toDayIdx)   return{...d,activities:[...d.activities,{...act,time:""}]};
        return d;
      });
    });
  }
  function replaceDays(updaterFn){ mutate(updaterFn); }

  // local-only setter — no cloud push, used for ephemeral realtime annotations
  function setDaysLocal(updaterFn){ setDays(updaterFn); }
  return{days,setDays:mutate,setDaysLocal,addActivity,removeActivity,reorderActivities,moveActivityToDay,replaceDays,syncStatus,syncError,cloudEnabled};
}

// ── Realtime Update Engine (inlined — no exports) ─────────────────────────────
function getNowMinutes(date=new Date()){ return date.getHours()*60+date.getMinutes(); }
function withComputedTiming(act){ const start=toMins(act.time),duration=parseDurationToMinutes(act.duration),end=start!=null?start+duration:null; return{...act,_rt:{start,end,duration}}; }
function getActivityStatus(act,nowMins){
  const start=act?._rt?.start,end=act?._rt?.end;
  if(start==null||end==null) return"unscheduled";
  if(nowMins<start-20) return"upcoming";
  if(nowMins>=start-20&&nowMins<start) return"soon";
  if(nowMins>=start&&nowMins<=end) return"live";
  if(nowMins>end&&nowMins<=end+30) return"just_finished";
  if(nowMins>end+30) return"missed_or_done";
  return"upcoming";
}
function buildActivityLiveMeta(act,nowMins,weatherForecast){
  const status=getActivityStatus(act,nowMins);
  const rainy=weatherLooksRainy(weatherForecast),outdoor=isOutdoorActivity(act);
  let warning="";
  if(rainy&&outdoor&&(status==="soon"||status==="upcoming"||status==="live")) warning="Rain may affect this outdoor activity.";
  let urgency="low";
  if(status==="soon") urgency="medium";
  if(status==="live") urgency="high";
  if(warning) urgency="high";
  return{...act,liveStatus:status,liveWarning:warning,liveUrgency:urgency};
}
function buildGlobalTripStatus(activities,nowMins){
  const live=activities.find(a=>a.liveStatus==="live");
  if(live) return{mode:"in_progress",title:"Current activity in progress",text:`${live.name} is currently happening.`,currentActivityId:live._id||live.name};
  const soon=activities.find(a=>a.liveStatus==="soon");
  if(soon){ const minsLeft=Math.max((soon._rt?.start??nowMins)-nowMins,0); return{mode:"starting_soon",title:"Next activity starts soon",text:`${soon.name} starts in about ${minsLeft} min.`,currentActivityId:soon._id||soon.name}; }
  const next=activities.find(a=>a.liveStatus==="upcoming");
  if(next) return{mode:"waiting",title:"Next planned stop",text:`${next.name} is your next planned activity.`,currentActivityId:next._id||next.name};
  return{mode:"free_time",title:"No active stop right now",text:"You currently have free time in the itinerary.",currentActivityId:null};
}
function buildRealtimeSuggestions(activities,nowMins,weatherForecast){
  const suggestions=[],rainy=weatherLooksRainy(weatherForecast);
  const live=activities.find(a=>a.liveStatus==="live"),soon=activities.find(a=>a.liveStatus==="soon"),upcoming=activities.find(a=>a.liveStatus==="upcoming"),missed=activities.filter(a=>a.liveStatus==="missed_or_done");
  if(live) suggestions.push({id:"focus-live",label:`Continue ${live.name}`,type:"status",text:"This is your current active stop."});
  if(soon) suggestions.push({id:"prep-next",label:`Prepare for ${soon.name}`,type:"next_step",text:"This stop begins soon."});
  if(rainy){ const affected=activities.find(a=>isOutdoorActivity(a)&&(a.liveStatus==="soon"||a.liveStatus==="upcoming")); if(affected) suggestions.push({id:"rain-swap",label:`Rain backup for ${affected.name}`,type:"weather",text:"Consider replacing this outdoor stop with an indoor option."}); }
  if(!live&&!soon&&upcoming) suggestions.push({id:"fill-gap",label:"Use free time smartly",type:"gap",text:"You currently have time before the next activity."});
  if(missed.length>=2) suggestions.push({id:"reoptimize",label:"Re-optimize day",type:"route",text:"The timeline looks out of sync. Re-optimization is recommended."});
  if(!suggestions.length) suggestions.push({id:"all-good",label:"Everything looks on track",type:"status",text:"No urgent itinerary adjustments needed."});
  return suggestions.slice(0,4);
}
function buildRealtimeDayState(day,nowDate=new Date()){
  const nowMins=getNowMinutes(nowDate);
  const acts=(day?.activities||[]).map(withComputedTiming);
  const enriched=acts.map(a=>buildActivityLiveMeta(a,nowMins,day?.weatherForecast||""));
  return{nowMins,nowTime:fmtTime(nowMins),tripStatus:buildGlobalTripStatus(enriched,nowMins),activities:enriched.map(({_rt,...rest})=>rest),realtimeSuggestions:buildRealtimeSuggestions(enriched,nowMins,day?.weatherForecast||"")};
}
function applyRealtimeDayState(day,realtimeState){
  const activityMap=new Map((realtimeState.activities||[]).map(a=>[a._id||a.name,a]));
  return{...day,activities:(day.activities||[]).map(a=>activityMap.get(a._id||a.name)||a),realtime:{nowTime:realtimeState.nowTime,tripStatus:realtimeState.tripStatus,realtimeSuggestions:realtimeState.realtimeSuggestions,updatedAt:new Date().toISOString()}};
}
function updateDayInRealtime(day,nowDate=new Date()){ return applyRealtimeDayState(day,buildRealtimeDayState(day,nowDate)); }
function updateTripInRealtime(days,nowDate=new Date()){ return(days||[]).map(day=>updateDayInRealtime(day,nowDate)); }
function shouldSuggestAutoReoptimize(day){ return(day?.realtime?.realtimeSuggestions||[]).some(s=>s.id==="reoptimize"); }
function buildRealtimeBanner(day){
  const status=day?.realtime?.tripStatus;
  if(!status) return{title:"Live trip status unavailable",text:"No realtime status yet."};
  return{title:status.title||"Live update",text:status.text||""};
}

// ── useRealtimeTripUpdates hook ────────────────────────────────────────────────
function useRealtimeTripUpdates({enabled,intervalMs=60000,setDays}){
  const timerRef=useRef(null);
  useEffect(()=>{
    if(!enabled) return;
    function tick(){ setDays(prev=>updateTripInRealtime(prev,new Date())); }
    tick();
    timerRef.current=setInterval(tick,intervalMs);
    return()=>{ if(timerRef.current) clearInterval(timerRef.current); };
  },[enabled,intervalMs]);
}

// ── RealtimeStatusPanel component ─────────────────────────────────────────────
function RealtimeStatusPanel({day,onReoptimize,onRefreshNow,realtimeEnabled,onToggleRealtime}){
  const banner=buildRealtimeBanner(day);
  const realtimeSuggestions=day?.realtime?.realtimeSuggestions||[];
  const nowTime=day?.realtime?.nowTime||"";
  return(
    <div className="fu" className="tm-grid tm-gap14">
      {/* Toggle + status */}
      <div className="tm-card">
        <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:12}}>
          <button onClick={onToggleRealtime} style={{padding:"9px 12px",borderRadius:10,border:"1px solid var(--tm-border)",background:realtimeEnabled?"#111":"#fff",color:realtimeEnabled?"#fff":"#111",fontWeight:700,fontFamily:"inherit"}}>
            {realtimeEnabled?"🟢 Realtime On":"⭕ Realtime Off"}
          </button>
          <span style={{fontSize:".8rem",color:"var(--tm-text2)"}}>Updates every minute · Now {nowTime||"—"}</span>
        </div>
        <div style={{fontWeight:800,marginBottom:6}}>{banner.title}</div>
        <div style={{fontSize:".82rem",color:"var(--tm-text2)",marginBottom:10}}>{banner.text}</div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <button onClick={onRefreshNow} style={{padding:"9px 12px",borderRadius:10,border:"1px solid var(--tm-border)",background:"var(--tm-bg)",color:"var(--tm-text)",fontWeight:700,fontFamily:"inherit"}}>⟳ Refresh now</button>
          <button onClick={onReoptimize} style={{padding:"9px 12px",borderRadius:10,border:"none",background:"#111",color:"#fff",fontWeight:700,fontFamily:"inherit"}}>🔀 Re-optimize day</button>
        </div>
      </div>
      {/* Realtime suggestions */}
      <div className="tm-card">
        <div className="tm-xbold tm-mb10">Live suggestions</div>
        <div style={{display:"grid",gap:10}}>
          {realtimeSuggestions.map(s=>(
            <div key={s.id} style={{border:"1px solid var(--tm-border)",borderRadius:12,padding:12,background:s.type==="weather"?"#fef9ec":s.type==="route"?"#fef2f2":"var(--tm-surface)",borderLeft:"3px solid "+(s.type==="weather"?"#b45309":s.type==="route"?"#dc2626":s.type==="next_step"?"#555":"var(--tm-border)")}}>
              <div style={{fontWeight:700,fontSize:".88rem"}}>{s.label}</div>
              <div style={{fontSize:".78rem",color:"var(--tm-text2)",marginTop:4}}>{s.text}</div>
            </div>
          ))}
          {!realtimeSuggestions.length&&<div style={{color:"var(--tm-text2)",fontSize:".82rem"}}>No live suggestions right now.</div>}
        </div>
      </div>
      {/* Live timeline */}
      <div className="tm-card">
        <div className="tm-xbold tm-mb10">Today's live timeline</div>
        <div className="tm-grid tm-gap8">
          {(day?.activities||[]).map(a=>{
            const isLive=a.liveStatus==="live",isSoon=a.liveStatus==="soon",isDone=a.liveStatus==="missed_or_done"||a.liveStatus==="just_finished";
            return(
              <div key={a._id||a.name} style={{padding:"10px 12px",borderRadius:10,background:isLive?"var(--tm-border)":isSoon?"#fef9ec":"var(--tm-surface)",border:"1.5px solid "+(isLive?"#555":isSoon?"#d97706":"var(--tm-border)"),opacity:isDone?.55:1}}>
                <div style={{display:"flex",justifyContent:"space-between",gap:10}}>
                  <div>
                    <div style={{fontWeight:700,fontSize:".86rem"}}>{typeEmoji(a.type)} {a.name}</div>
                    <div style={{fontSize:".73rem",color:"var(--tm-text2)",marginTop:2}}>{a.time||"--:--"} · {a.type||"Activity"}</div>
                  </div>
                  <span style={{padding:"3px 9px",borderRadius:999,background:"var(--tm-bg)",border:"1px solid var(--tm-border)",fontSize:".68rem",fontWeight:700,height:"fit-content",whiteSpace:"nowrap",color:isLive?"#111":isSoon?"#d97706":isDone?"#8A9CAA":"#555"}}>
                    {isLive?"● Live":isSoon?"⏱ Soon":isDone?"✓ Done":a.liveStatus==="upcoming"?"○ Upcoming":"○ Unscheduled"}
                  </span>
                </div>
                {a.liveWarning&&<div style={{marginTop:7,fontSize:".76rem",color:"#b45309",background:"#fef9ec",padding:"5px 8px",borderRadius:6}}>⚠ {a.liveWarning}</div>}
              </div>
            );
          })}
          {!(day?.activities||[]).length&&<div style={{color:"var(--tm-text3)",fontSize:".82rem",textAlign:"center",padding:"16px 0"}}>No activities for this day yet.</div>}
        </div>
      </div>
    </div>
  );
}

// ── Live Trip Control Engine (inlined — toMins/fmtTime/parseDurationToMinutes/getNowMinutes/haversineKm/estimateTravelMinutes reuse globals) ──
function enrichActivityTiming(act){ const start=toMins(act.time),duration=parseDurationToMinutes(act.duration),end=start!=null?start+duration:null; return{...act,_live:{start,end,duration}}; }
function getStatus(act,nowMins){
  const start=act?._live?.start,end=act?._live?.end;
  if(start==null||end==null) return"unscheduled";
  if(nowMins<start-20) return"upcoming";
  if(nowMins>=start-20&&nowMins<start) return"soon";
  if(nowMins>=start&&nowMins<=end) return"live";
  if(nowMins>end&&nowMins<=end+30) return"just_finished";
  if(nowMins>end+30) return"past";
  return"upcoming";
}
function getNextPlannedActivity(day,nowDate=new Date()){
  const nowMins=getNowMinutes(nowDate);
  const acts=(day?.activities||[]).map(enrichActivityTiming).map(a=>({...a,liveStatus:getStatus(a,nowMins)}));
  return acts.find(a=>a.liveStatus==="live")||acts.find(a=>a.liveStatus==="soon")||acts.find(a=>a.liveStatus==="upcoming")||null;
}
function getDistanceToNextStop(day,userLoc,transport="mixed",nowDate=new Date()){
  const next=getNextPlannedActivity(day,nowDate);
  if(!next||!userLoc||next.lat==null||next.lng==null) return{nextActivity:next||null,km:null,etaMinutes:null,canEstimate:false};
  const km=haversineKm({lat:userLoc.lat,lng:userLoc.lng},{lat:next.lat,lng:next.lng});
  const etaMinutes=estimateTravelMinutes(km,transport);
  return{nextActivity:next,km:km!=null?Number(km.toFixed(2)):null,etaMinutes,canEstimate:km!=null&&etaMinutes!=null};
}
function detectLateRisk(day,userLoc,transport="mixed",nowDate=new Date()){
  const nowMins=getNowMinutes(nowDate),dist=getDistanceToNextStop(day,userLoc,transport,nowDate),next=dist.nextActivity;
  if(!next||!dist.canEstimate) return{isLateRisk:false,level:"unknown",text:"Not enough data to estimate lateness.",nextActivity:next||null};
  const start=toMins(next.time);
  if(start==null) return{isLateRisk:false,level:"unknown",text:"Next activity has no valid start time.",nextActivity:next};
  const margin=start-(nowMins+dist.etaMinutes);
  if(margin>=20) return{isLateRisk:false,level:"safe",text:`You should arrive about ${margin} min early for ${next.name}.`,nextActivity:next,etaMinutes:dist.etaMinutes,km:dist.km,minutesEarly:margin};
  if(margin>=0) return{isLateRisk:true,level:"tight",text:`Timing is tight for ${next.name}. You may arrive just in time.`,nextActivity:next,etaMinutes:dist.etaMinutes,km:dist.km,minutesEarly:margin};
  return{isLateRisk:true,level:"late",text:`You are likely to be late for ${next.name} by about ${Math.abs(margin)} min.`,nextActivity:next,etaMinutes:dist.etaMinutes,km:dist.km,minutesLate:Math.abs(margin)};
}
function delayRemainingActivities(day,delayMinutes,nowDate=new Date()){
  const nowMins=getNowMinutes(nowDate);
  return{...day,activities:(day.activities||[]).map(act=>{const start=toMins(act.time);return start!=null&&start>=nowMins?{...act,time:fmtTime(start+delayMinutes)}:act;}),liveAdjustment:{type:"delay",delayMinutes,updatedAt:new Date().toISOString()}};
}
function skipActivity(day,activityId){
  return{...day,activities:(day.activities||[]).filter(a=>(a._id||a.name)!==activityId),liveAdjustment:{type:"skip",skippedActivityId:activityId,updatedAt:new Date().toISOString()}};
}
function rebuildRestOfDay(day,nowDate=new Date()){
  const nowMins=getNowMinutes(nowDate);
  const past=[],future=[];
  for(const act of(day.activities||[])){ const start=toMins(act.time),end=start!=null?start+parseDurationToMinutes(act.duration):null; (end!=null&&end<nowMins?past:future).push(act); }
  let cursor=nowMins+15;
  const rebuiltFuture=future.map(act=>{const duration=parseDurationToMinutes(act.duration),next={...act,time:fmtTime(cursor)};cursor+=duration+20;return next;});
  return{...day,activities:[...past,...rebuiltFuture],liveAdjustment:{type:"rebuild_rest_of_day",updatedAt:new Date().toISOString()}};
}
function getRealtimeControlActions(day,userLoc,transport="mixed",nowDate=new Date()){
  const lateRisk=detectLateRisk(day,userLoc,transport,nowDate),next=lateRisk.nextActivity,actions=[];
  if(!next) return{lateRisk,actions:[{id:"no-next-stop",label:"No next stop detected",type:"info"}]};
  if(lateRisk.level==="tight") actions.push({id:"delay-15",label:"Delay next stops by 15 min",type:"delay",minutes:15},{id:"rebuild",label:"Rebuild rest of day",type:"rebuild"});
  if(lateRisk.level==="late") actions.push({id:"skip-next",label:`Skip ${next.name}`,type:"skip",activityId:next._id||next.name},{id:"delay-30",label:"Delay next stops by 30 min",type:"delay",minutes:30},{id:"rebuild",label:"Rebuild rest of day",type:"rebuild"});
  if(lateRisk.level==="safe") actions.push({id:"all-good",label:"Timing looks good",type:"info"});
  return{lateRisk,actions};
}

// ── LiveTripControlPanel component ────────────────────────────────────────────
function LiveTripControlPanel({day,lateRisk,controlActions,onDelay,onSkipNext,onRebuild,onRefresh}){
  const next=lateRisk?.nextActivity||null;
  const lvl=lateRisk?.level;
  return(
    <div className="tm-grid tm-gap14">
      {/* Status card */}
      <div className="tm-card">
        <div style={{fontWeight:800,marginBottom:8}}>🗺 Live trip control</div>
        <div style={{padding:"10px 12px",borderRadius:10,background:lvl==="late"?"#fef2f2":lvl==="tight"?"#fff7ed":"var(--tm-surface)",color:"var(--tm-text)",marginBottom:12,fontSize:".84rem",lineHeight:1.5}}>
          {lateRisk?.text||"No live timing info available."}
        </div>
        {next&&<div style={{border:"1px solid var(--tm-border)",borderRadius:10,padding:12,background:"var(--tm-surface)",marginBottom:12}}>
          <div style={{fontWeight:700}}>{typeEmoji(next.type)} {next.name}</div>
          <div style={{fontSize:".78rem",color:"var(--tm-text2)",marginTop:3}}>{next.time||"--:--"} · {next.type||"Activity"}</div>
          {(lateRisk?.km!=null||lateRisk?.etaMinutes!=null)&&<div style={{fontSize:".78rem",color:"var(--tm-text2)",marginTop:5}}>
            {lateRisk.km!=null?`${lateRisk.km} km`:""}{lateRisk.km!=null&&lateRisk.etaMinutes!=null?" · ":""}{lateRisk.etaMinutes!=null?`${lateRisk.etaMinutes} min away`:""}
          </div>}
        </div>}
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <button onClick={onRefresh} style={{padding:"9px 12px",borderRadius:10,border:"1px solid var(--tm-border)",background:"var(--tm-bg)",color:"var(--tm-text)",fontWeight:700,fontFamily:"inherit"}}>⟳ Refresh</button>
          <button onClick={()=>onDelay(15)} style={{padding:"9px 12px",borderRadius:10,border:"1px solid var(--tm-border)",background:"var(--tm-bg)",color:"var(--tm-text)",fontWeight:700,fontFamily:"inherit"}}>+15 min</button>
          <button onClick={()=>onDelay(30)} style={{padding:"9px 12px",borderRadius:10,border:"1px solid var(--tm-border)",background:"var(--tm-bg)",color:"var(--tm-text)",fontWeight:700,fontFamily:"inherit"}}>+30 min</button>
          <button onClick={()=>onDelay(60)} style={{padding:"9px 12px",borderRadius:10,border:"1px solid var(--tm-border)",background:"var(--tm-bg)",color:"var(--tm-text)",fontWeight:700,fontFamily:"inherit"}}>+60 min</button>
          {next&&<button onClick={onSkipNext} style={{padding:"9px 12px",borderRadius:10,border:"none",background:"#b91c1c",color:"#fff",fontWeight:700,fontFamily:"inherit"}}>⏭ Skip next stop</button>}
          <button onClick={onRebuild} style={{padding:"9px 12px",borderRadius:10,border:"none",background:"#111",color:"#fff",fontWeight:700,fontFamily:"inherit"}}>🔀 Rebuild rest of day</button>
        </div>
      </div>
      {/* Suggested actions */}
      {(controlActions||[]).length>0&&<div className="tm-card">
        <div className="tm-xbold tm-mb10">Suggested actions</div>
        <div className="tm-grid tm-gap8">
          {(controlActions||[]).map(a=>(
            <div key={a.id} style={{padding:"10px 12px",borderRadius:10,background:a.type==="info"?"var(--tm-surface)":a.type==="skip"?"#fef2f2":a.type==="rebuild"?"var(--tm-border)":"#fff7ed",border:"1px solid var(--tm-border)",borderLeft:"3px solid "+(a.type==="info"?"var(--tm-border)":a.type==="skip"?"#dc2626":a.type==="rebuild"?"#555":"#d97706")}}>
              <div style={{fontWeight:700,fontSize:".86rem"}}>{a.label}</div>
              <div style={{fontSize:".73rem",color:"var(--tm-text3)",marginTop:2,textTransform:"capitalize"}}>{a.type}</div>
            </div>
          ))}
        </div>
      </div>}
      {/* Timeline */}
      <div className="tm-card">
        <div className="tm-xbold tm-mb10">Today's timeline</div>
        <div className="tm-grid tm-gap8">
          {(day?.activities||[]).map(a=>(
            <div key={a._id||a.name} style={{padding:"10px 12px",borderRadius:10,background:"var(--tm-surface)",border:"1px solid var(--tm-border)"}}>
              <div style={{fontWeight:700,fontSize:".86rem"}}>{typeEmoji(a.type)} {a.name}</div>
              <div style={{fontSize:".76rem",color:"var(--tm-text2)",marginTop:3}}>{a.time||"--:--"} · {a.type||"Activity"}</div>
              {a.liveAdjustment&&<div style={{fontSize:".68rem",color:"var(--tm-text2)",marginTop:4,fontStyle:"italic"}}>Adjusted: {a.liveAdjustment?.type}</div>}
            </div>
          ))}
          {!(day?.activities||[]).length&&<div style={{color:"var(--tm-text3)",fontSize:".82rem",textAlign:"center",padding:"14px 0"}}>No activities scheduled.</div>}
        </div>
      </div>
    </div>
  );
}

// ── Smart Fallback Picker Engine (inlined — uid/hasAny/weatherLooksRainy/weatherLooksHot/parseDurationToMinutes/isDining reuse globals) ──
function textOf(item){ return[item?.name||"",item?.type||"",item?.desc||"",item?.address||"",item?.tip||""].join(" ").toLowerCase(); }
function weatherLooksCold(wf){ const m=String(wf||"").match(/(-?\d+)/),t=m?Number(m[1]):null; return t!=null&&t<=8; }
function isOutdoor(item){ const t=textOf(item); return hasAny(t,["park","garden","beach","viewpoint","lookout","walk","walking","hike","market","boat","outdoor","nature","architecture"]); }
function isIndoor(item){ const t=textOf(item); return hasAny(t,["museum","gallery","cafe","coffee","restaurant","spa","shopping","mall","cathedral","church","cinema","theater","library","indoor","market hall"]); }
function similarityPenalty(candidate,originalActivity){
  if(!originalActivity) return 0;
  const c=textOf(candidate),o=textOf(originalActivity);
  let penalty=0;
  if(isDining(candidate)&&isDining(originalActivity)) penalty+=2;
  if(isIndoor(candidate)&&isIndoor(originalActivity)) penalty+=1;
  if(c.includes("museum")&&o.includes("museum")) penalty+=2;
  if(c.includes("gallery")&&o.includes("gallery")) penalty+=2;
  return penalty;
}
function timeFitAlt(candidate,originalActivity){ return originalActivity?.time?4:0; }
function durationFit(candidate,originalActivity){
  if(!originalActivity) return 0;
  const diff=Math.abs(parseDurationToMinutes(candidate.duration)-parseDurationToMinutes(originalActivity.duration));
  return diff<=20?6:diff<=45?3:0;
}
function interestFit(candidate,interests=[]){
  const t=textOf(candidate);
  const map={"Food & Dining":["restaurant","cafe","bakery","food","wine","bar"],Culture:["museum","gallery","culture","theater","history"],History:["history","historic","cathedral","church","palace","castle"],Nightlife:["bar","cocktail","club","pub","live music"],Nature:["park","garden","beach","hike","lake","river"],Art:["art","gallery","museum","atelier"],Shopping:["shopping","boutique","market","vintage","design store"],"Hidden Spots":["hidden gem","local favorite","quiet","off the beaten path"],Architecture:["architecture","cathedral","palace","tower"],Wellness:["spa","wellness","sauna","yoga"],Photography:["viewpoint","sunset","lookout","scenic"]};
  return interests.reduce((score,interest)=>score+(hasAny(t,map[interest]||[])?4:0),0);
}
function weatherScore(candidate,weatherForecast,originalActivity){
  let score=0;
  const rainy=weatherLooksRainy(weatherForecast),cold=weatherLooksCold(weatherForecast),hot=weatherLooksHot(weatherForecast);
  if(rainy){ if(isIndoor(candidate)) score+=14; if(isOutdoor(candidate)) score-=18; }
  if(cold){ if(isIndoor(candidate)) score+=8; if(isOutdoor(candidate)) score-=8; }
  if(hot){ if(isIndoor(candidate)) score+=6; if(isOutdoor(candidate)) score-=4; }
  if(rainy&&originalActivity&&isOutdoor(originalActivity)&&isIndoor(candidate)) score+=8;
  return score;
}
function buildFallbackReason(weatherForecast,originalActivity,candidate){
  const rainy=weatherLooksRainy(weatherForecast),cold=weatherLooksCold(weatherForecast),hot=weatherLooksHot(weatherForecast);
  if(rainy&&originalActivity&&isOutdoor(originalActivity)&&isIndoor(candidate)) return `Good weather alternative because ${originalActivity.name} is outdoors and rain may affect it.`;
  if(rainy) return "Good weather alternative for a rainy day.";
  if(cold) return "Good weather alternative for colder conditions.";
  if(hot) return "Good weather alternative when it is very hot.";
  return "Good fallback option for current conditions.";
}
function scoreCandidate(candidate,context){
  return weatherScore(candidate,context.weatherForecast,context.originalActivity)+durationFit(candidate,context.originalActivity)+timeFitAlt(candidate,context.originalActivity)+interestFit(candidate,context.interests||[])-similarityPenalty(candidate,context.originalActivity);
}
function buildWeatherFallbackOptions({originalActivity,candidatePlaces=[],weatherForecast,interests=[],maxResults=4}){
  const badWeather=weatherLooksRainy(weatherForecast)||weatherLooksCold(weatherForecast)||weatherLooksHot(weatherForecast);
  if(!badWeather||!originalActivity) return[];
  return[...candidatePlaces]
    .map((p,idx)=>({...p,fallbackScore:scoreCandidate(p,{originalActivity,weatherForecast,interests}),_idx:idx}))
    .filter(p=>p.fallbackScore>0)
    .sort((a,b)=>b.fallbackScore!==a.fallbackScore?b.fallbackScore-a.fallbackScore:a._idx-b._idx)
    .slice(0,maxResults)
    .map(({_idx,...p})=>({_id:p._id||uid(),name:p.name||"Alternative",type:p.type||"Activity",desc:p.desc||"",address:p.address||"",duration:p.duration||originalActivity.duration||"1h 30m",time:originalActivity.time||p.time||"",price:p.price||"Free",isFree:!!p.isFree||String(p.price||"").toLowerCase().includes("free"),tip:p.tip||"",transport:p.transport||"",imgQuery:p.imgQuery||p.name||"travel",fallbackLabel:"Weather alternative",fallbackReason:buildFallbackReason(weatherForecast,originalActivity,p),replacesActivityId:originalActivity._id||originalActivity.name,weatherFallback:true,fallbackScore:p.fallbackScore}));
}
function addFallbackAsAlternative(day,fallback){ return{...day,weatherAlternatives:[...(day.weatherAlternatives||[]),fallback]}; }
function replaceActivityWithFallback(day,fallback){
  const targetId=fallback.replacesActivityId;
  return{...day,activities:(day.activities||[]).map(a=>(a._id||a.name)===targetId?{...fallback,_id:a._id||fallback._id,replacedOriginalName:a.name}:a)};
}
function dismissFallback(day,fallbackId){ return{...day,weatherAlternatives:(day.weatherAlternatives||[]).filter(f=>(f._id||f.name)!==fallbackId)}; }

// ── WeatherFallbackPanel component ────────────────────────────────────────────
function WeatherFallbackPanel({weatherForecast,selectedActivity,fallbackOptions,onAddAlternative,onReplaceWithFallback,onDismiss}){
  if(!selectedActivity) return(
    <div className="tm-card">
      <div style={{fontWeight:800,marginBottom:6}}>🌦 Weather fallback</div>
      <div style={{fontSize:".82rem",color:"var(--tm-text2)"}}>Select an activity first to see weather-based alternatives.</div>
    </div>
  );
  const rainy=weatherLooksRainy(weatherForecast),cold=weatherLooksCold(weatherForecast),hot=weatherLooksHot(weatherForecast);
  const weatherBadge=rainy?"🌧 Rainy":cold?"🥶 Cold":hot?"🌡 Hot":"";
  return(
    <div className="fu" className="tm-grid tm-gap14">
      {/* Selected activity + weather context */}
      <div className="tm-card">
        <div style={{fontWeight:800,marginBottom:6}}>🌦 Weather fallback options</div>
        <div style={{fontSize:".82rem",color:"var(--tm-text2)",marginBottom:10}}>
          Current weather: <b>{weatherForecast||"unknown"}</b>{weatherBadge?" · "+weatherBadge:""}
        </div>
        <div style={{padding:"10px 12px",borderRadius:10,background:"var(--tm-surface)",border:"1px solid var(--tm-border)"}}>
          <div style={{fontWeight:700}}>{typeEmoji(selectedActivity.type)} {selectedActivity.name}</div>
          <div style={{fontSize:".78rem",color:"var(--tm-text2)",marginTop:3}}>{selectedActivity.time||"--:--"} · {selectedActivity.type||"Activity"}</div>
        </div>
      </div>
      {/* Alternatives */}
      <div className="tm-card">
        <div className="tm-xbold tm-mb10">Suggested weather alternatives</div>
        {!fallbackOptions.length&&<div style={{color:"var(--tm-text2)",fontSize:".82rem"}}>No strong weather alternatives found right now.</div>}
        <div style={{display:"grid",gap:10}}>
          {fallbackOptions.map(f=>(
            <div key={f._id} style={{border:"1px solid var(--tm-border)",borderRadius:12,padding:12,background:"var(--tm-surface)",borderLeft:"3px solid #555"}}>
              <div style={{display:"flex",justifyContent:"space-between",gap:10,marginBottom:6}}>
                <div>
                  <div className="tm-xbold">{typeEmoji(f.type)} {f.name}</div>
                  <div style={{fontSize:".76rem",color:"var(--tm-text2)",marginTop:3}}>{f.type}{f.time?` · ${f.time}`:""}{f.duration?` · ${f.duration}`:""}</div>
                </div>
                <span style={{padding:"3px 9px",borderRadius:50,background:"var(--tm-surface2)",color:"var(--tm-text)",fontWeight:700,fontSize:".68rem",flexShrink:0,height:"fit-content"}}>Weather alt</span>
              </div>
              {f.desc&&<div style={{fontSize:".8rem",color:"var(--tm-text)",lineHeight:1.45,marginBottom:6}}>{f.desc}</div>}
              {f.fallbackReason&&<div style={{fontSize:".76rem",color:"var(--tm-text2)",marginBottom:6}}><b>Why this fits:</b> {f.fallbackReason}</div>}
              {f.address&&<div style={{fontSize:".75rem",color:"var(--tm-text3)",marginBottom:8}}>📍 {f.address}</div>}
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                <button onClick={()=>onAddAlternative(f)} style={{padding:"8px 12px",borderRadius:8,border:"1px solid var(--tm-border)",background:"var(--tm-bg)",color:"var(--tm-text)",fontWeight:700,fontFamily:"inherit"}}>+ Add as alternative</button>
                <button onClick={()=>onReplaceWithFallback(f)} style={{padding:"8px 12px",borderRadius:8,border:"none",background:"#111",color:"#fff",fontWeight:700,fontFamily:"inherit"}}>Replace current activity</button>
                <button onClick={()=>onDismiss(f._id)} style={{padding:"8px 12px",borderRadius:8,border:"1px solid var(--tm-border)",background:"var(--tm-bg)",color:"var(--tm-text3)",fontWeight:700,fontFamily:"inherit"}}>Dismiss</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── GroupPlanningPanel v2 component ───────────────────────────────────────────
function GroupPlanningPanel({groupState,currentDay,currentUserId,destination,tripId,tripData,onAddMember,onRemoveMember,onAddSuggestion,onVoteSuggestion,onClearSuggestionVote,onSetSuggestionStatus,onDeleteSuggestion,onAddComment,onMergeApproved,onVoteActivity}){
  const [memberName,setMemberName]=useState("");
  const [title,setTitle]=useState("");
  const [type,setType]=useState("Restaurant");
  const [notes,setNotes]=useState("");
  const [commentDrafts,setCommentDrafts]=useState({});
  const [inviteCopied,setInviteCopied]=useState(false);
  const dayNumber=currentDay?.day;
  const suggestions=getSuggestionsForDay(groupState,dayNumber);
  const approvedCount=suggestions.filter(s=>s.status==="approved").length;
  const isSolo=groupState.members.length<2;

  function submitSuggestion(){
    if(!title.trim()) return;
    onAddSuggestion({dayNumber,title,type,notes,destination});
    setTitle("");setType("Restaurant");setNotes("");
  }
  function submitComment(suggestionId){
    const text=commentDrafts[suggestionId]||""; if(!text.trim()) return;
    onAddComment(suggestionId,text);
    setCommentDrafts(p=>({...p,[suggestionId]:""}));
  }
  function copyInviteLink(){
    const id=tripId||tripData?.id||Date.now();
    const url=window.location.origin+window.location.pathname+"?joinTrip="+id;
    try{localStorage.setItem("tm_invite_"+id,JSON.stringify({...tripData,id}));}catch(_){}
    navigator.clipboard?.writeText(url).then(()=>{
      setInviteCopied(true); setTimeout(()=>setInviteCopied(false),2500);
    }).catch(()=>prompt(T("copyLink"),url));
  }

  return(
    <div className="fu" className="tm-grid tm-gap14">
      {/* Header */}
      <div className="tm-card">
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
          <div>
            <div style={{fontWeight:800,marginBottom:4}}>👥 Gruppenplanung — Tag {dayNumber}</div>
            <div style={{fontSize:".8rem",color:"var(--tm-text2)"}}>Vorschläge machen, abstimmen, diskutieren — genehmigte Ideen kommen ins Programm.</div>
          </div>
          <button onClick={copyInviteLink} style={{flexShrink:0,padding:"8px 12px",borderRadius:10,border:"none",background:inviteCopied?"#16a34a":"#111",color:"#fff",fontWeight:700,fontSize:".75rem",fontFamily:"inherit",cursor:"pointer",whiteSpace:"nowrap",transition:"background .2s"}}>
            {inviteCopied?T("inviteCopied"):T("invite")}
          </button>
        </div>
      </div>
      {/* Solo invite prompt */}
      {isSolo&&<div style={{background:"linear-gradient(135deg,#F7F7F7,#EFEFEF)",border:"1.5px dashed #CDCDCD",borderRadius:14,padding:20,textAlign:"center"}}>
        <div style={{fontSize:"2rem",marginBottom:8}}>🧳</div>
        <div style={{fontWeight:800,fontSize:"1rem",color:"var(--tm-text)",marginBottom:6}}>Lade Mitreisende ein</div>
        <div style={{fontSize:".8rem",color:"var(--tm-text2)",lineHeight:1.6,marginBottom:14}}>Sobald jemand beitritt, können alle Vorschläge machen und abstimmen — gemeinsam plant es sich besser.</div>
        <button onClick={copyInviteLink} style={{padding:"11px 20px",borderRadius:12,border:"none",background:inviteCopied?"#16a34a":"#111",color:"#fff",fontWeight:800,fontSize:".9rem",fontFamily:"inherit",cursor:"pointer",transition:"background .2s"}}>
          {inviteCopied?T("linkCopied"):T("copyInviteLink")}
        </button>
      </div>}
      {/* Members */}
      <div className="tm-card">
        <div className="tm-xbold tm-mb10">Travel Group</div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>
          {groupState.members.map(m=>(
            <div key={m.id} style={{display:"flex",alignItems:"center",gap:5,padding:"6px 11px",borderRadius:999,background:m.id===currentUserId?"var(--tm-border)":"var(--tm-border)",border:"1px solid var(--tm-border)"}}>
              <span style={{fontSize:".78rem",fontWeight:700}}>{m.id===currentUserId?"✓ ":""}{m.name}{m.role==="owner"?" · owner":""}</span>
              {m.role!=="owner"&&<button onClick={()=>onRemoveMember(m.id)} style={{border:"none",background:"transparent",color:"var(--tm-text3)",cursor:"pointer",fontWeight:700,fontSize:".85rem",lineHeight:1}}>×</button>}
            </div>
          ))}
        </div>
        <div className="tm-flex tm-gap8">
          <input value={memberName} onChange={e=>setMemberName(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&memberName.trim()){onAddMember(memberName);setMemberName("");}}} placeholder="Add traveler name…" style={{flex:1,padding:"10px 12px",borderRadius:10,border:"1px solid var(--tm-border)",fontFamily:"inherit",fontSize:"16px"}}/>
          <button onClick={()=>{if(memberName.trim()){onAddMember(memberName);setMemberName("");}}} style={{padding:"10px 14px",borderRadius:10,border:"none",background:"#111",color:"#fff",fontWeight:700,fontFamily:"inherit",minHeight:44}}>Add</button>
        </div>
      </div>
      {/* Suggest form */}
      <div className="tm-card">
        <div className="tm-xbold tm-mb10">Suggest something for Day {dayNumber}</div>
        <div className="tm-grid tm-gap8">
          <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Rooftop bar, museum, brunch place…" style={{padding:"10px 12px",borderRadius:10,border:"1px solid var(--tm-border)",fontFamily:"inherit",fontSize:"16px"}}/>
          <select value={type} onChange={e=>setType(e.target.value)} style={{padding:"10px 12px",borderRadius:10,border:"1px solid var(--tm-border)",fontFamily:"inherit"}}>
            {["Restaurant","Cafe","Bar","Museum","Viewpoint","Shopping","Wellness","Activity"].map(t=><option key={t}>{t}</option>)}
          </select>
          <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={3} placeholder="Why does this fit the group?" style={{padding:"10px 12px",borderRadius:10,border:"1px solid var(--tm-border)",fontFamily:"inherit",resize:"none"}}/>
          <button onClick={submitSuggestion} disabled={!title.trim()} style={{padding:"11px 14px",borderRadius:10,border:"none",background:title.trim()?"#555":"var(--tm-border)",color:"#fff",fontWeight:700,fontFamily:"inherit",minHeight:44}}>Submit suggestion</button>
        </div>
      </div>
      {/* Suggestions list */}
      <div className="tm-card">
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,marginBottom:12}}>
          <div>
            <div className="tm-xbold">Group Suggestions</div>
            <div style={{fontSize:".75rem",color:"var(--tm-text2)",marginTop:3}}>{suggestions.length} total · {approvedCount} approved</div>
          </div>
          {approvedCount>0&&<button onClick={onMergeApproved} style={{padding:"9px 12px",borderRadius:10,border:"none",background:"#111",color:"#fff",fontWeight:700,fontFamily:"inherit",whiteSpace:"nowrap"}}>Add approved to itinerary</button>}
        </div>
        {!suggestions.length&&<div style={{textAlign:"center",padding:"20px 0",fontSize:".82rem",color:"var(--tm-text3)"}}>No suggestions yet. Be the first!</div>}
        <div className="tm-grid tm-gap12">
          {suggestions.map(s=>{
            const myVote=s.votes?.[currentUserId]||0;
            const score=scoreVotes(s.votes);
            const isApproved=s.status==="approved";
            const isRejected=s.status==="rejected";
            const comments=groupState.commentsBySuggestionId[s.id]||[];
            return(
              <div key={s.id} style={{border:"1.5px solid "+(isApproved?"#555":isRejected?"#fecaca":"var(--tm-border)"),borderRadius:12,padding:12,background:isApproved?"var(--tm-surface)":isRejected?"#fef2f2":"var(--tm-surface)",position:"relative",opacity:isRejected?.6:1}}>
                {isApproved&&<div style={{position:"absolute",top:0,left:0,right:0,height:3,borderRadius:"12px 12px 0 0",background:"#555"}}/>}
                <div style={{display:"flex",justifyContent:"space-between",gap:10,marginBottom:6}}>
                  <div style={{minWidth:0}}>
                    <div style={{fontWeight:800,fontSize:".9rem"}}>{typeEmoji(s.type)} {s.title}</div>
                    <div style={{fontSize:".7rem",color:"var(--tm-text3)",marginTop:2}}>{s.type} · by {getMemberName(groupState,s.createdBy)} · {new Date(s.createdAt).toLocaleDateString()}</div>
                  </div>
                  <span style={{padding:"3px 9px",borderRadius:50,fontSize:".68rem",fontWeight:700,flexShrink:0,background:isApproved?"var(--tm-border)":isRejected?"#fef2f2":"var(--tm-border)",color:isApproved?"#111":isRejected?"#dc2626":"#555",border:"1px solid "+(isApproved?"var(--tm-border)":isRejected?"#fecaca":"var(--tm-border)"),height:"fit-content"}}>
                    {isApproved?"✓ Approved":isRejected?"✗ Rejected":"Pending"}
                  </span>
                </div>
                {s.notes&&<p style={{fontSize:".78rem",color:"var(--tm-text2)",lineHeight:1.5,margin:"0 0 8px"}}>{s.notes}</p>}
                {/* Vote row */}
                <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap",marginBottom:8}}>
                  <button onClick={()=>myVote===1?onClearSuggestionVote(s.id):onVoteSuggestion(s.id,1)} style={{padding:"6px 10px",borderRadius:8,border:"1.5px solid "+(myVote===1?"#111":"var(--tm-border)"),background:myVote===1?"var(--tm-border)":"#fff",fontWeight:700,fontFamily:"inherit"}}>👍</button>
                  <span style={{fontSize:".85rem",fontWeight:900,color:score>0?"#111":score<0?"#dc2626":"#8A9CAA",minWidth:22,textAlign:"center"}}>{score>0?"+":""}{score}</span>
                  <button onClick={()=>myVote===-1?onClearSuggestionVote(s.id):onVoteSuggestion(s.id,-1)} style={{padding:"6px 10px",borderRadius:8,border:"1.5px solid "+(myVote===-1?"#dc2626":"var(--tm-border)"),background:myVote===-1?"#fef2f2":"#fff",fontWeight:700,fontFamily:"inherit"}}>👎</button>
                  <div style={{flex:1}}/>
                  {!isApproved&&<button onClick={()=>onSetSuggestionStatus(s.id,"approved")} style={{padding:"5px 10px",borderRadius:7,border:"none",background:"#555",color:"#fff",fontSize:".72rem",fontWeight:700,fontFamily:"inherit"}}>✓ Approve</button>}
                  {!isRejected&&<button onClick={()=>onSetSuggestionStatus(s.id,"rejected")} style={{padding:"5px 10px",borderRadius:7,border:"none",background:"var(--tm-surface2)",color:"var(--tm-text3)",fontSize:".72rem",fontWeight:700,fontFamily:"inherit"}}>✗ Reject</button>}
                  {(isApproved||isRejected)&&<button onClick={()=>onSetSuggestionStatus(s.id,"pending")} style={{padding:"5px 8px",borderRadius:7,border:"1px solid var(--tm-border)",background:"var(--tm-bg)",color:"var(--tm-text2)",fontSize:".72rem",fontFamily:"inherit"}}>↺ Reset</button>}
                  <button onClick={()=>onDeleteSuggestion(s.id)} style={{padding:"5px 8px",borderRadius:7,border:"1px solid var(--tm-border)",background:"var(--tm-bg)",color:"var(--tm-text3)",fontSize:".72rem",fontFamily:"inherit"}}>🗑</button>
                </div>
                {/* Voter summary */}
                {Object.keys(s.votes||{}).length>0&&<div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:8}}>
                  {Object.entries(s.votes).filter(([,v])=>v!==0).map(([mid,v])=>(
                    <span key={mid} style={{fontSize:".62rem",padding:"1px 7px",borderRadius:50,background:v===1?"var(--tm-border)":"#fef2f2",color:v===1?"#111":"#dc2626",border:"1px solid "+(v===1?"var(--tm-border)":"#fecaca"),fontWeight:600}}>{v===1?"▲":"▼"} {getMemberName(groupState,mid)}</span>
                  ))}
                </div>}
                {/* Comments */}
                {comments.length>0&&<div style={{marginBottom:8,display:"flex",flexDirection:"column",gap:4}}>
                  {comments.map(c=>(
                    <div key={c.id} style={{fontSize:".74rem",color:"var(--tm-text2)",padding:"5px 9px",background:"var(--tm-surface2)",borderRadius:7}}>
                      <b>{getMemberName(groupState,c.memberId)}</b>: {c.text}
                    </div>
                  ))}
                </div>}
                <div style={{display:"flex",gap:7}}>
                  <input value={commentDrafts[s.id]||""} onChange={e=>setCommentDrafts(p=>({...p,[s.id]:e.target.value}))} onKeyDown={e=>{if(e.key==="Enter"&&(commentDrafts[s.id]||"").trim()) submitComment(s.id);}} placeholder="Add a comment…" style={{flex:1,padding:"6px 9px",borderRadius:8,border:"1px solid var(--tm-border)",fontSize:".75rem",fontFamily:"inherit"}}/>
                  <button onClick={()=>submitComment(s.id)} style={{padding:"6px 10px",borderRadius:8,border:"none",background:"#111",color:"#fff",fontSize:".72rem",fontWeight:700,fontFamily:"inherit"}}>Send</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {/* Vote on current itinerary */}
      {(currentDay?.activities||[]).length>0&&<div className="tm-card">
        <div className="tm-xbold tm-mb10">Vote on today's itinerary</div>
        <div className="tm-grid tm-gap8">
          {(currentDay.activities||[]).map(a=>{
            const actId=a._id||a.name;
            const actScore=getActivityVoteScore(groupState,dayNumber,actId);
            return(
              <div key={actId} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:10,background:"var(--tm-surface)",border:"1px solid var(--tm-border)"}}>
                <div>
                  <div style={{fontWeight:700,fontSize:".84rem"}}>{typeEmoji(a.type)} {a.name}</div>
                  <div style={{fontSize:".73rem",color:"var(--tm-text2)"}}>{a.time||"--:--"} · {a.type||"Activity"}</div>
                </div>
                <div style={{display:"flex",gap:6,alignItems:"center"}}>
                  <button onClick={()=>onVoteActivity(actId,1)} style={{padding:"6px 10px",borderRadius:8,border:"1px solid var(--tm-border)",background:"var(--tm-bg)",fontFamily:"inherit"}}>👍</button>
                  <span style={{fontSize:".8rem",fontWeight:700,color:actScore>0?"#111":actScore<0?"#dc2626":"#8A9CAA",minWidth:18,textAlign:"center"}}>{actScore>0?"+":""}{actScore}</span>
                  <button onClick={()=>onVoteActivity(actId,-1)} style={{padding:"6px 10px",borderRadius:8,border:"1px solid var(--tm-border)",background:"var(--tm-bg)",fontFamily:"inherit"}}>👎</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>}
    </div>
  );
}

// ── Time Conflict Detector ────────────────────────────────────────────────────
function detectTimeConflicts(activities){
  const out=[];
  for(let i=0;i<activities.length-1;i++){
    const a=activities[i];
    const b=activities[i+1];
    const aStart=toMins(a.time);
    const aDur=parseDurationToMinutes(a.duration);
    const bStart=toMins(b.time);
    if(aStart!=null&&aDur>0&&bStart!=null){
      const aEnd=aStart+aDur+(a.travelMinsToNext||0);
      if(bStart<aEnd) out.push({indexA:i,indexB:i+1,nameA:a.name,nameB:b.name,overlapMins:aEnd-bStart});
    }
  }
  return out;
}


// ── Trip Screen ────────────────────────────────────────────────────────────────

// ── Transit URL helpers (Live Mode) ────────────────────────────────────────────
const TRANSIT_SITES={
  paris:"https://www.ratp.fr/en/plan-your-journey",
  london:"https://tfl.gov.uk/plan-a-journey/",
  berlin:"https://www.bvg.de/en",
  amsterdam:"https://9292.nl/en",
  vienna:"https://www.wienerlinien.at/en",
  rome:"https://www.atac.roma.it/en",
  barcelona:"https://www.tmb.cat/en/home",
  madrid:"https://www.crtm.es/en/",
  lisbon:"https://www.carris.pt/en/",
  prague:"https://www.dpp.cz/en",
  budapest:"https://bkk.hu/en/",
  copenhagen:"https://www.rejseplanen.dk/en/",
  stockholm:"https://sl.se/en",
  oslo:"https://ruter.no/en/",
  zurich:"https://www.zvv.ch/en/",
  munich:"https://www.mvv-muenchen.de/en/",
  hamburg:"https://www.hvv.de/en",
  tokyo:"https://www.tokyometro.jp/en/",
  osaka:"https://www.osakametro.co.jp/en/",
  "new york":"https://www.mta.info/",
  "san francisco":"https://www.bart.gov/",
  chicago:"https://www.transitchicago.com/",
  singapore:"https://www.transitlink.com.sg/",
  "hong kong":"https://www.mtr.com.hk/en/",
  seoul:"https://www.seoulmetro.co.kr/en/",
  sydney:"https://transportnsw.info/",
  melbourne:"https://www.ptv.vic.gov.au/",
};
function getLocalTransitUrl(destination){
  if(!destination) return null;
  const d=destination.toLowerCase();
  for(const [city,url] of Object.entries(TRANSIT_SITES)){
    if(d.includes(city)) return url;
  }
  return null;
}
function buildTransitUrl(userLoc,toAct,destination){
  if(!toAct) return null;
  const destStr=toAct.address?`${toAct.name}, ${toAct.address}`:`${toAct.name}, ${destination||""}`;
  const destEnc=encodeURIComponent(destStr);
  if(userLoc?.lat&&userLoc?.lng){
    const origin=encodeURIComponent(`${userLoc.lat},${userLoc.lng}`);
    return`https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destEnc}&travelmode=transit`;
  }
  return`https://www.google.com/maps/dir/?api=1&destination=${destEnc}&travelmode=transit`;
}

// ── Suggestion inline form (own component to keep hooks at top level) ──────────
function SuggestionInlineForm({dayNum,destination,onSubmit}){
  const [open,setOpen]=useState(false);
  const [stitle,setStitle]=useState("");
  const [snotes,setSnotes]=useState("");
  if(!open) return(
    <button onClick={()=>setOpen(true)} style={{width:"100%",padding:"10px",borderRadius:10,border:"1.5px dashed var(--tm-border)",background:"var(--tm-bg)",color:"var(--tm-text2)",fontWeight:700,fontFamily:"inherit",marginTop:4,cursor:"pointer"}}>
      + Eigenen Vorschlag einreichen
    </button>
  );
  return(
    <div style={{border:"1px solid var(--tm-border)",borderRadius:12,padding:14,background:"var(--tm-bg)",marginTop:8}}>
      <div style={{fontWeight:700,fontSize:".82rem",marginBottom:8,color:"var(--tm-text)"}}>Vorschlag einreichen</div>
      <input value={stitle} onChange={e=>setStitle(e.target.value)} placeholder={T("placeName")} style={{width:"100%",padding:"9px 11px",borderRadius:8,border:"1px solid var(--tm-border)",fontFamily:"inherit",fontSize:".84rem",marginBottom:8,boxSizing:"border-box"}}/>
      <textarea value={snotes} onChange={e=>setSnotes(e.target.value)} placeholder={T("placeWhy")} rows={2} style={{width:"100%",padding:"9px 11px",borderRadius:8,border:"1px solid var(--tm-border)",fontFamily:"inherit",resize:"none",fontSize:".82rem",boxSizing:"border-box"}}/>
      <div style={{display:"flex",gap:8,marginTop:8}}>
        <button onClick={()=>{if(!stitle.trim())return;onSubmit({dayNumber:dayNum,title:stitle.trim(),type:"Activity",notes:snotes.trim(),destination});setStitle("");setSnotes("");setOpen(false);}}
          style={{flex:1,padding:"9px",borderRadius:9,border:"none",background:"#111",color:"#fff",fontWeight:700,fontFamily:"inherit",cursor:"pointer"}}>Einreichen</button>
        <button onClick={()=>setOpen(false)} style={{padding:"9px 13px",borderRadius:9,border:"1px solid var(--tm-border)",background:"var(--tm-bg)",color:"var(--tm-text2)",fontWeight:700,fontFamily:"inherit",cursor:"pointer"}}>Abbrechen</button>
      </div>
    </div>
  );
}

// ── Personality-based single-day regen prompt ─────────────────────────────────
function buildPersonalityRegenPrompt(dayNum,totalDays,destination,form,personalityId){
  const p=TRIP_PERSONALITIES[personalityId]||TRIP_PERSONALITIES.explorer;
  const interests=(form?.interests||[]).join(", ")||"general sightseeing";
  const travelers=form?.travelers||1;
  const travelerStr=travelers>1?`Group of ${travelers} travellers`:`Solo traveller`;
  const travelStyle=form?.style||"medium";
  const hotel=form?.hotel||"";
  const hotelLine=hotel?`Hotel: ${hotel}.`:"";
  // Transit constraints
  const isFirst=dayNum===1,isLast=dayNum===totalDays;
  const parts=[];
  if(isFirst&&form?.arrivalTime) parts.push(`Arrival at ${form.arrivalTime}. Only start activities at least 1h after arrival.`);
  if(isLast&&form?.departureTime) parts.push(`Departure at ${form.departureTime}. Last activity must end 2h before departure.`);
  const tc=parts.join(" ");
  const numActs=isFirst||isLast?3:5;
  // ── Safety rule ──
  const safetyRule="SAFETY RULE — MANDATORY: Never suggest adult entertainment, strip clubs, brothels, erotic or sexual services, sex shops, peep shows, or red-light district venues. All suggestions must be family-safe and culturally respectful. Relaxed or Luxury personalities mean wellness spa, yoga, nature walks, fine dining — never adult venues. This rule overrides everything else.";
  return "You are a travel expert. Respond ONLY with a single JSON object — no markdown, no extra text.\n"
    +safetyRule+"\n"
    +`Plan day ${dayNum} of ${totalDays} in ${destination}. ${travelerStr}. Style: ${travelStyle}. Interests: ${interests}. ${hotelLine} ${tc}\n`
    +`PERSONALITY: ${p.label} — ${p.description} Pace: ${p.pace}. Dining: ${p.diningStyle}. Activity focus: ${p.activityBias.join(", ")}.\n`
    +"Only include activities open at scheduled time (museums 09-18, bars 20+, restaurants: lunch 12-15, dinner 19-23).\n"
    +`Include exactly ${numActs} activities. Make them specific, authentic, and personality-appropriate.\n`
    +"Return exactly:\n"
    +'{"day":'+dayNum+',"theme":"short 3-word location or activity theme (e.g. Old Town Walk, Harbour & Markets, Museum District)","neighborhood":"area name",'
    +'"weatherForecast":"Sunny 22C","timeWindow":"09:00-22:00",'
    +'"budget":{"budget":"50 EUR","medium":"100 EUR","luxury":"200 EUR"},'
    +'"evening":"one sentence evening suggestion",'
    +'"lunch":{"name":"place","cuisine":"type","price":"15 EUR","desc":"short","imgQuery":"food keyword"},'
    +'"dinner":{"name":"place","cuisine":"type","price":"25 EUR","desc":"short","imgQuery":"food keyword"},'
    +'"activities":[{"time":"09:00","name":"place name","type":"Museum","desc":"very short desc",'
    +'"address":"street, city","duration":"2h","price":"12 EUR","isFree":false,"isHidden":false,'
    +'"openHours":"09:00-18:00","tip":"short insider tip","transport":"Metro line X","imgQuery":"3 words"}]}';
}

function Trip({data,form,onBack,onSave,onShare,savedTrips=[]}){
  const tripId=data.id||data._tripId||null;
  const {days,setDays,setDaysLocal,addActivity,removeActivity,reorderActivities,moveActivityToDay,replaceDays,syncStatus,syncError,cloudEnabled}=useTripSync(
    tripId,
    (data.days||[]).map(d=>({...d,activities:(d.activities||[]).map(a=>({_id:uid(),...a}))}))
  );
  const [activeDay,setActiveDay]=useState(0);
  const [tab,setTab]=useState("plan");
  const [userLoc,setUserLoc]=useState(null);
  const [showAdd,setShowAdd]=useState(false);
  const [movingAct,setMovingAct]=useState(null); // {actId, fromDay} — triggers day-picker sheet
  const [showExport,setShowExport]=useState(false);
  const [showTripMenu,setShowTripMenu]=useState(false);
  const [showTransportSheet,setShowTransportSheet]=useState(false);
  const [dragIndex,setDragIndex]=useState(null);
  const [dragOverIndex,setDragOverIndex]=useState(null);
  const touchDrag=useRef({active:false,fromIdx:null,toIdx:null});
  const [placesLoading,setPlacesLoading]=useState(false);
  const [placesResults,setPlacesResults]=useState([]);
  const [placesQuery,setPlacesQuery]=useState("");
  const [altMode,setAltMode]=useState("budget");
  const [conciergeMsg,setConciergeMsg]=useState("");
  const [conciergeReply,setConciergeReply]=useState(null);
  const [conciergeLoading,setConciergeLoading]=useState(false);
  // conciergeApiKey removed — API key lives on the server via /api/chat, never in the browser
  const [gemsMode,setGemsMode]=useState(false);
  const [routeOptLoading,setRouteOptLoading]=useState(false);
  const [hiddenGemResults,setHiddenGemResults]=useState([]);
  const [personalityId,setPersonalityId]=useState(()=>{try{return localStorage.getItem("tm_personality")||getDefaultPersonalityFromForm(form);}catch(_){return getDefaultPersonalityFromForm(form);}});
  function savePersonality(id){setPersonalityId(id);try{localStorage.setItem("tm_personality",id);}catch(_){}}

  // ── Reactive personality: save + immediately regenerate active day via AI ──
  async function handlePersonalityChange(newId){
    if(regenLoading) return; // ignore double-clicks while generating
    savePersonality(newId);
    setRegenLoading(true);
    const dest=data.destination;
    const dayNum=activeDay+1;
    const total=days.length;
    const prompt=buildPersonalityRegenPrompt(dayNum,total,dest,form,newId);
    try{
      const dayData=await callAI(prompt,950);
      if(!dayData||!Array.isArray(dayData.activities)) throw new Error("No activities");
      const newActs=(dayData.activities||[]).map(a=>({_id:uid(),...a}));
      const dIdx=activeDay;
      replaceDays(prev=>prev.map((d,i)=>i!==dIdx?d:{
        ...d,
        activities:newActs,
        ...(dayData.theme?{theme:dayData.theme}:{}),
        ...(dayData.neighborhood?{neighborhood:dayData.neighborhood}:{}),
        ...(dayData.evening?{evening:dayData.evening}:{}),
        ...(dayData.lunch?{lunch:dayData.lunch}:{}),
        ...(dayData.dinner?{dinner:dayData.dinner}:{}),
      }));
      // Geocode new activities in background so map updates with real coords
      (async()=>{
        const geoR=(q)=>fetch("https://nominatim.openstreetmap.org/search?format=json&limit=3&q="+encodeURIComponent(q)).then(r=>r.json()).catch(()=>[]);
        const sleep=(ms)=>new Promise(res=>setTimeout(res,ms));
        const cityData=await geoR(dest);
        let viewbox=null;
        if(cityData&&cityData[0]){
          const c={lat:+cityData[0].lat,lng:+cityData[0].lon};
          viewbox=`${c.lng-0.15},${c.lat+0.15},${c.lng+0.15},${c.lat-0.15}`;
        }
        const geoLocal=async(q)=>{
          if(viewbox){
            const url=`https://nominatim.openstreetmap.org/search?format=json&limit=3&q=${encodeURIComponent(q)}&viewbox=${viewbox}&bounded=1`;
            const d=await fetch(url).then(r=>r.json()).catch(()=>[]);
            if(d&&d[0]) return d;
          }
          return geoR(q);
        };
        await sleep(300);
        for(let ai=0;ai<newActs.length;ai++){
          const act=newActs[ai];
          const q=act.name+(act.address?", "+act.address:"")+", "+dest;
          const d=await geoLocal(q);
          if(d&&d[0]){
            const lat=+d[0].lat,lng=+d[0].lon,actId=act._id;
            replaceDays(prev=>prev.map((dd,i)=>i!==dIdx?dd:{
              ...dd,activities:dd.activities.map(a=>a._id===actId?{...a,lat,lng}:a)
            }));
          }
          if(ai<newActs.length-1) await sleep(300);
        }
      })();
    }catch(err){
      console.error("Personality regen failed:",err);
    }
    setRegenLoading(false);
  }
  // ── Inline editor ──────────────────────────────────────────────────────────
  const [editingActId,setEditingActId]=useState(null);
  const [editDraft,setEditDraft]=useState({});
  // ── Undo stack ─────────────────────────────────────────────────────────────
  const undoStackRef=useRef([]);
  const [undoCount,setUndoCount]=useState(0);
  // ── Push notifications ─────────────────────────────────────────────────────
  const [notifEnabled,setNotifEnabled]=useState(()=>{try{return localStorage.getItem("tm_notif")==="1";}catch(_){return false;}});
  // ── Budget limit ───────────────────────────────────────────────────────────
  const [budgetLimit,setBudgetLimit]=useState(()=>{try{const v=localStorage.getItem("tm_budget_limit");return v?Number(v):null;}catch(_){return null;}});
  const [dayBudgetLimit,setDayBudgetLimit]=useState(()=>{try{const v=localStorage.getItem("tm_day_budget_limit");return v?Number(v):null;}catch(_){return null;}});
  const [showBudgetSheet,setShowBudgetSheet]=useState(false);
  // ── Personality regen ──────────────────────────────────────────────────────
  const [regenLoading,setRegenLoading]=useState(false);
  const [showPersonalityPicker,setShowPersonalityPicker]=useState(false);
  // ── Save flash toast ───────────────────────────────────────────────────────
  const [savedFlash,setSavedFlash]=useState(false);
  const [isSaved,setIsSaved]=useState(()=>!!data.id&&savedTrips.some(t=>t.id===data.id));
  function handleSave(){
    onSave({days,groupState});
    setIsSaved(true);
    setSavedFlash(true);
    setTimeout(()=>setSavedFlash(false),2500);
  }
  const day=days[activeDay]||{};
  const totalDays=days.length;

  // ── Clock tick: re-render every 60 s so live status stays current ──────────
  const [,setTick]=useState(0);
  useEffect(()=>{
    const id=setInterval(()=>setTick(t=>t+1),60000);
    return()=>clearInterval(id);
  },[]);

  // ── Auto-select today's day when Trip opens ──────────────────────────────
  useEffect(()=>{
    if(!form?.startDate) return;
    try{
      const tripStart=new Date(form.startDate+"T00:00:00");
      const today=new Date(); today.setHours(0,0,0,0);
      const idx=Math.round((today-tripStart)/86400000);
      if(idx>=0&&idx<days.length) setActiveDay(idx);
    }catch(_){}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  // Enrich activities with liveStatus when it's today's day
  const nowMinsLive=getNowMinutes();
  const _isTodayDay=(()=>{
    if(!form?.startDate) return false;
    try{
      const tripStart=new Date(form.startDate+"T00:00:00");
      const dayDate=new Date(tripStart.getTime()+activeDay*86400000);
      const today=new Date();
      return dayDate.getFullYear()===today.getFullYear()&&dayDate.getMonth()===today.getMonth()&&dayDate.getDate()===today.getDate();
    }catch(_){return false;}
  })();
  const acts=_isTodayDay
    ?(day.activities||[]).map(a=>buildActivityLiveMeta(a,nowMinsLive,day.weatherForecast||""))
    :(day.activities||[]);

  // ── Background geocoding: store accurate lat/lng in every activity after trip loads ──
  const bgGeoRunRef=useRef(false);
  useEffect(()=>{
    if(bgGeoRunRef.current) return;
    bgGeoRunRef.current=true;
    const dest=data.destination;
    if(!dest) return;
    const sleep=(ms)=>new Promise(res=>setTimeout(res,ms));
    const geo=(q)=>fetch("https://nominatim.openstreetmap.org/search?format=json&limit=3&q="+encodeURIComponent(q)).then(r=>r.json()).catch(()=>[]);
    let cancelled=false;
    async function run(){
      await sleep(800); // let map finish initial render first
      // Geocode city to build a viewbox — keeps all results inside the right city
      const cityData=await geo(dest);
      if(cancelled) return;
      let cityCenter=null;
      let viewbox=null;
      if(cityData&&cityData[0]){
        cityCenter={lat:+cityData[0].lat,lng:+cityData[0].lon};
        viewbox=`${cityCenter.lng-0.15},${cityCenter.lat+0.15},${cityCenter.lng+0.15},${cityCenter.lat-0.15}`;
      }
      const geoLocal=async(q)=>{
        if(viewbox){
          const url=`https://nominatim.openstreetmap.org/search?format=json&limit=3&q=${encodeURIComponent(q)}&viewbox=${viewbox}&bounded=1`;
          const d=await fetch(url).then(r=>r.json()).catch(()=>[]);
          if(d&&d[0]) return d;
        }
        return geo(q); // fallback: unbounded global search
      };
      await sleep(300);
      // Collect all geocoded coords first, then apply in ONE replaceDays call.
      // This avoids firing N state updates (one per activity) which would cause
      // DayMap to restart its own geocoding loop N times.
      const geoResults=new Map(); // `${dayIdx}:${actId}` → {lat,lng}
      for(let di=0;di<days.length;di++){
        const dayActs=(days[di].activities||[]);
        for(let ai=0;ai<dayActs.length;ai++){
          if(cancelled) return;
          const act=dayActs[ai];
          if(act.lat&&act.lng){continue;} // already geocoded — skip
          // Name-first query is most accurate for Nominatim
          const q=act.name+(act.address?", "+act.address:"")+", "+dest;
          const d=await geoLocal(q);
          if(cancelled) return;
          if(d&&d[0]){
            geoResults.set(`${di}:${act._id||act.name}`,{lat:+d[0].lat,lng:+d[0].lon});
          }
          // No city-center-offset fallback — wrong pin is worse than missing pin
          if(di<days.length-1||ai<dayActs.length-1) await sleep(300);
        }
      }
      // Apply all coords in a single state update → only one re-render → DayMap not disturbed
      if(!cancelled&&geoResults.size>0){
        replaceDays(prev=>prev.map((dd,di)=>({
          ...dd,
          activities:dd.activities.map(a=>{
            const geo=geoResults.get(`${di}:${a._id||a.name}`);
            return geo?{...a,...geo}:a;
          })
        })));
      }
    }
    run();
    return()=>{cancelled=true;};
  },[]); // runs once on mount

  function removeAct(id){ removeActivity(activeDay,id); }
  function addAct(a){ addActivity(activeDay,a); }
  function lockActivity(id){
    replaceDays(prev=>prev.map((d,i)=>{
      if(i!==activeDay) return d;
      const cur=d.activities.find(a=>(a._id||a.name)===id);
      return markActivityLocked(d,id,!(cur?.locked));
    }));
  }
  function requestLoc(){ if(!navigator.geolocation){alert(T("geoUnsupported"));return;} navigator.geolocation.getCurrentPosition(p=>setUserLoc({lat:p.coords.latitude,lng:p.coords.longitude}),()=>alert(T("couldNotGetLocation"))); }
  function optimizeCurrentDay(){ replaceDays(p=>p.map((d,i)=>i!==activeDay?d:optimizeDayPlan(d,form,p.length))); }
  function optimizeAllDays(){ replaceDays(p=>optimizeWholeTrip(p,form)); }
  function rainProof(){ replaceDays(p=>p.map((d,i)=>i!==activeDay?d:optimizeDayPlan(replaceOutdoorForRain(d),form,p.length))); }
  function applyAlternativePlan(){ replaceDays(p=>p.map((d,i)=>i!==activeDay?d:optimizeDayPlan(buildAlternativePlan(d,altMode),form,p.length))); }
  function onDragStart(index){ setDragIndex(index); }
  async function onDropAt(index){
    if(dragIndex==null||dragIndex===index) return;
    const reordered=reorderActivitiesLocally(days[activeDay]?.activities||[],dragIndex,index);
    setDragIndex(null);
    await retimeCurrentDayAfterManualReorder(reordered);
  }
  function onDragEnd(){ setDragIndex(null); setDragOverIndex(null); }

  // Touch drag — non-passive listener prevents page scroll while dragging
  useEffect(()=>{
    const h=(e)=>{ if(touchDrag.current.active) e.preventDefault(); };
    document.addEventListener('touchmove',h,{passive:false});
    return()=>document.removeEventListener('touchmove',h);
  },[]);
  function onActTouchStart(e,i){
    touchDrag.current={active:true,fromIdx:i,toIdx:i};
    setDragIndex(i);
  }
  function onActTouchMove(e){
    if(!touchDrag.current.active) return;
    const t=e.touches[0];
    const el=document.elementFromPoint(t.clientX,t.clientY);
    const card=el?.closest('[data-actidx]');
    if(card){
      const idx=parseInt(card.dataset.actidx);
      if(!isNaN(idx)&&idx!==touchDrag.current.toIdx){
        touchDrag.current.toIdx=idx;
        setDragOverIndex(idx);
      }
    }
  }
  function onActTouchEnd(){
    if(!touchDrag.current.active) return;
    const{fromIdx,toIdx}=touchDrag.current;
    touchDrag.current={active:false,fromIdx:null,toIdx:null};
    setDragIndex(null);
    setDragOverIndex(null);
    if(fromIdx!==null&&toIdx!==null&&fromIdx!==toIdx) onDropAt(toIdx);
  }

  async function retimeCurrentDayAfterManualReorder(updatedActivities){
    setRouteOptLoading(true);
    try{
      const dayDraft={...days[activeDay],activities:updatedActivities};
      const nextDay=await retimeAfterManualReorder({day:dayDraft,form,totalDays,destination:data.destination,hotel:form.hotel});
      replaceDays(prev=>prev.map((d,i)=>i===activeDay?nextDay:d));
    }catch(err){
      // fallback: apply reorder without timing on geocode failure
      replaceDays(prev=>prev.map((d,i)=>i===activeDay?{...d,activities:updatedActivities}:d));
    }finally{setRouteOptLoading(false);}
  }
  async function runPlacesSearch(){
    if(!placesQuery.trim()) return;
    setPlacesLoading(true);
    try{ const r=await searchPlaces({query:placesQuery,destination:data.destination}); setPlacesResults(r); }
    catch(err){ alert(err.message||"Places search failed"); }
    finally{ setPlacesLoading(false); }
  }
  function addPlaceResultToDay(place){ addActivity(activeDay,place); }
  function exportPDFLike(){ exportTripAsPrintableHTML(data,form,days); }
  async function shareCurrentTrip(){ try{ await shareTripText(data,form,days); }catch(err){ alert(err.message||"Share failed"); } }
  async function runConcierge(msg){
    const q=(msg||conciergeMsg).trim(); if(!q) return;
    setConciergeLoading(true); setConciergeReply(null);
    try{
      const reply=await askTravelConcierge({destination:data.destination,hotel:form.hotel,currentDay:day,allDays:days,activeDayIndex:activeDay,userMessage:q,userLoc,travelers:form.travelers,ageGroup:form.ageGroup,style:form.style,interests:form.interests});
      setConciergeReply(reply);
    }catch(e){alert(e.message||"Concierge failed");}
    finally{setConciergeLoading(false);}
  }
  async function optimizeRoute(keepSeq=false){
    setRouteOptLoading(true);
    try{
      const optimized=await optimizeRouteForDay({day,form,totalDays,destination:data.destination,hotel:form.hotel,keepUserSequence:keepSeq});
      replaceDays(p=>p.map((d,i)=>i!==activeDay?d:optimized));
    }catch(err){alert(err.message||"Route optimize failed");}
    finally{setRouteOptLoading(false);}
  }
  const routeLoading=routeOptLoading;
  function optimizeCurrentDayRoute(){ return optimizeRoute(false); }
  function addHiddenGemToDay(gem){ addActivity(activeDay,{...gem,_id:uid()}); setHiddenGemResults(prev=>prev.filter(g=>g._id!==gem._id&&g.name!==gem.name)); }
  function applyPersonalityToCurrentDay(){
    replaceDays(prev=>prev.map((d,i)=>i!==activeDay?d:applyTripPersonalityToDay(d,form,personalityId||"explorer",prev.length)));
  }
  function applyPersonalityToWholeTrip(){
    replaceDays(prev=>applyTripPersonalityToTrip(prev,form,personalityId||"explorer"));
  }
  // ── Group Planning state v2 ────────────────────────────────────────────────
  const [groupState,setGroupState]=useState(()=>{
    if(tripId){try{const s=localStorage.getItem("tm_gs_"+tripId);if(s){const p=JSON.parse(s);if(p?.members) return p;}}catch(_){}}
    return createInitialGroupState([{id:"u1",name:form?.travelers>1?"Organiser":"You",role:"owner"}]);
  });
  // ── currentUser: read from localStorage (set by join flow) or default to owner ─
  const [currentUser]=useState(()=>{
    try{
      const stored=localStorage.getItem("tm_user_"+tripId);
      if(stored) return JSON.parse(stored);
    }catch(_){}
    // Owner default — first member in groupState
    const owner=groupState.members?.[0];
    return{id:owner?.id||"u1",name:owner?.name||"You",avatar:(owner?.name||"Y")[0].toUpperCase()};
  });
  const currentUserId=currentUser.id;
  // Group features are only shown once at least one other person has joined
  const isGroupTrip=groupState.members.length>=2;
  // ── Group toast notifications ──────────────────────────────────────────────
  const [groupToast,setGroupToast]=useState(null);
  const groupToastTimer=useRef(null);
  function showGroupToast(msg){
    clearTimeout(groupToastTimer.current);
    setGroupToast(msg);
    groupToastTimer.current=setTimeout(()=>setGroupToast(null),3000);
  }
  // Auto-persist groupState whenever it changes (debounced)
  const groupStateRef=useRef(groupState);
  groupStateRef.current=groupState;
  useEffect(()=>{
    if(!tripId) return;
    const timer=setTimeout(()=>{
      try{localStorage.setItem("tm_gs_"+tripId,JSON.stringify(groupStateRef.current));}catch(_){}
    },400);
    return()=>clearTimeout(timer);
  },[groupState,tripId]);
  const planMapRef=useRef(null); // {zoomTo} from DayMap onReady
  const [zoomActId,setZoomActId]=useState(null);
  // ── Live Mode refs & derived state ────────────────────────────────────────
  const actCardRefs=useRef({});
  const isLiveModeDay=_isTodayDay;
  const nextStopAct=isLiveModeDay?(acts.find(a=>a.liveStatus==="live")||acts.find(a=>a.liveStatus==="soon")||null):null;
  const nextStopId=nextStopAct?(nextStopAct._id||nextStopAct.name):null;
  function handleAddMember(memberName){
    setGroupState(prev=>addGroupMember(prev,memberName));
    showGroupToast("👤 "+memberName+" zur Gruppe hinzugefügt");
  }
  function handleRemoveMember(memberId){ setGroupState(prev=>removeGroupMember(prev,memberId)); }
  function handleAddSuggestion({dayNumber,title,type,notes,destination:dest}){
    setGroupState(prev=>addSuggestion(prev,{dayNumber,createdBy:currentUserId,title,type,notes,activityData:buildSuggestionActivityData({title,type,notes,destination:dest})}));
    showGroupToast("💡 Vorschlag eingereicht");
  }
  function handleVoteSuggestion(suggestionId,value){
    const dayNumber=days[activeDay]?.day;
    setGroupState(prev=>{
      const updated=updateSuggestionVote(prev,dayNumber,suggestionId,currentUserId,value);
      const afterAuto=autoApproveTopSuggestions(updated,dayNumber,2);
      const before=getSuggestionsForDay(prev,dayNumber).filter(s=>s.status==="approved").length;
      const after=getSuggestionsForDay(afterAuto,dayNumber).filter(s=>s.status==="approved").length;
      if(after>before) showGroupToast("✅ Vorschlag automatisch genehmigt!");
      return afterAuto;
    });
  }
  function handleClearSuggestionVote(suggestionId){
    const dayNumber=days[activeDay]?.day;
    setGroupState(prev=>clearSuggestionVote(prev,dayNumber,suggestionId,currentUserId));
  }
  function handleSetSuggestionStatus(suggestionId,status){
    const dayNumber=days[activeDay]?.day;
    setGroupState(prev=>setSuggestionStatus(prev,dayNumber,suggestionId,status));
  }
  function handleDeleteSuggestion(suggestionId){
    const dayNumber=days[activeDay]?.day;
    setGroupState(prev=>deleteSuggestion(prev,dayNumber,suggestionId));
  }
  function handleAddComment(suggestionId,text){ setGroupState(prev=>addSuggestionComment(prev,suggestionId,currentUserId,text)); }
  function handleMergeApprovedSuggestions(){
    replaceDays(prev=>prev.map((d,i)=>i!==activeDay?d:mergeApprovedSuggestionsIntoActivities(d,groupState)));
  }
  function handleVoteExistingActivity(activityId,value){
    const dayNumber=days[activeDay]?.day;
    setGroupState(prev=>voteOnExistingActivity(prev,dayNumber,activityId,currentUserId,value));
  }
  // ── Undo stack ─────────────────────────────────────────────────────────────
  function pushUndo(){ undoStackRef.current=[...undoStackRef.current.slice(-19),days]; setUndoCount(undoStackRef.current.length); }
  function replaceDaysUndoable(updater){ pushUndo(); replaceDays(updater); }
  useEffect(()=>{
    function onKey(e){
      if((e.ctrlKey||e.metaKey)&&e.key==="z"&&!e.shiftKey&&undoStackRef.current.length>0){
        e.preventDefault();
        const prev=undoStackRef.current[undoStackRef.current.length-1];
        undoStackRef.current=undoStackRef.current.slice(0,-1);
        setUndoCount(undoStackRef.current.length);
        replaceDays(()=>prev);
      }
    }
    window.addEventListener("keydown",onKey);
    return()=>window.removeEventListener("keydown",onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);
  // ── Live mode: auto-scroll to next stop when day is live ──────────────────
  useEffect(()=>{
    if(!isLiveModeDay||!nextStopId||tab!=="plan") return;
    const el=actCardRefs.current[nextStopId];
    if(el) el.scrollIntoView({behavior:"smooth",block:"start"});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[isLiveModeDay,nextStopId,tab]);
  // ── Live mode: auto-zoom map to next stop ─────────────────────────────────
  useEffect(()=>{
    if(!isLiveModeDay||!nextStopAct||tab!=="plan") return;
    if(nextStopAct.lat&&nextStopAct.lng&&planMapRef.current?.zoomTo){
      planMapRef.current.zoomTo(nextStopAct._id||nextStopAct.name);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[isLiveModeDay,nextStopId,tab]);
  // ── Inline activity editor ─────────────────────────────────────────────────
  function startEditAct(a){
    setEditingActId(a._id||a.name);
    setEditDraft({name:a.name||"",time:a.time||"",duration:a.duration||"",type:a.type||"",price:a.price||"",desc:a.desc||""});
  }
  function saveEditAct(){
    if(!editingActId) return;
    pushUndo();
    replaceDays(prev=>prev.map((d,i)=>i!==activeDay?d:{...d,activities:d.activities.map(a=>(a._id||a.name)===editingActId?{...a,...editDraft}:a)}));
    setEditingActId(null);
  }
  // ── Visited / Rating / Note ────────────────────────────────────────────────
  function toggleVisited(actId){
    pushUndo();
    replaceDays(prev=>prev.map((d,i)=>i!==activeDay?d:{...d,activities:d.activities.map(a=>(a._id||a.name)===actId?{...a,_visited:!a._visited}:a)}));
  }
  function setRating(actId,rating){
    replaceDays(prev=>prev.map((d,i)=>i!==activeDay?d:{...d,activities:d.activities.map(a=>(a._id||a.name)===actId?{...a,_rating:rating}:a)}));
  }
  function setActNote(actId,note){
    replaceDays(prev=>prev.map((d,i)=>i!==activeDay?d:{...d,activities:d.activities.map(a=>(a._id||a.name)===actId?{...a,_note:note}:a)}));
  }
  // ── Push notifications (Service Worker backed) ─────────────────────────────
  const [notifScheduledCount,setNotifScheduledCount]=useState(0);
  const [showNotifPanel,setShowNotifPanel]=useState(false);

  async function requestNotifications(){
    if(!("Notification" in window)){alert(T("notifUnsupported"));return false;}
    const perm=await Notification.requestPermission();
    const on=perm==="granted";
    setNotifEnabled(on);
    try{localStorage.setItem("tm_notif",on?"1":"0");}catch(_){}
    if(on) sendScheduleToSW(days);
    return on;
  }
  function disableNotifications(){
    setNotifEnabled(false);
    try{localStorage.setItem("tm_notif","0");}catch(_){}
    if("serviceWorker" in navigator){
      navigator.serviceWorker.ready.then(reg=>{
        if(reg.active) reg.active.postMessage({type:"TM_CLEAR"});
      }).catch(()=>{});
    }
    setNotifScheduledCount(0);
  }
  // Build a flat schedule of fireAt timestamps (15 min before each activity)
  function buildSchedule(allDays,baseDate){
    const schedule=[];
    const base=baseDate||form?.startDate;
    allDays.forEach((d,di)=>{
      if(!d.activities) return;
      // Create a fresh Date per day — base + offset
      const dayDate=base?new Date(new Date(base+"T00:00:00").getTime()+di*86400000):null;
      d.activities.forEach((a,ai)=>{
        const tMins=toMins(a.time);
        if(tMins==null) return;
        let fireAt;
        if(dayDate){
          const fire=new Date(dayDate);
          fire.setHours(Math.floor((tMins-15)/60),((tMins-15)%60+60)%60,0,0);
          fireAt=fire.getTime();
        } else {
          // No date known — fire relative to today by time of day
          const now=new Date();
          const nowMins=now.getHours()*60+now.getMinutes();
          if(tMins-15<=nowMins) return;
          fireAt=Date.now()+(tMins-15-nowMins)*60000;
        }
        if(fireAt>Date.now()) schedule.push({
          id:`d${di}a${ai}`,
          name:a.name||"Aktivität",
          time:a.time,
          day:di+1,
          fireAt,
        });
      });
    });
    return schedule;
  }
  function sendScheduleToSW(allDays){
    if(!("serviceWorker" in navigator)) return;
    const schedule=buildSchedule(allDays);
    navigator.serviceWorker.ready.then(reg=>{
      if(reg.active){
        reg.active.postMessage({type:"TM_SCHEDULE",schedule});
        setNotifScheduledCount(schedule.length);
      }
    }).catch(()=>{});
  }
  // Listen for ACK from SW with confirmed count
  useEffect(()=>{
    if(!("serviceWorker" in navigator)) return;
    function onMsg(e){
      if(e.data?.type==="TM_SCHEDULE_ACK") setNotifScheduledCount(e.data.count||0);
    }
    navigator.serviceWorker.addEventListener("message",onMsg);
    return()=>navigator.serviceWorker.removeEventListener("message",onMsg);
  },[]);
  useEffect(()=>{
    // Register SW once on mount, then re-send schedule if notifs already enabled
    if(!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js")
      .then(()=>navigator.serviceWorker.ready)
      .then(()=>{
        if(notifEnabled) sendScheduleToSW(days);
      }).catch(()=>{});
    // Re-feed SW whenever it changes controller (e.g. after update/restart)
    function onController(){
      if(notifEnabled) sendScheduleToSW(days);
    }
    navigator.serviceWorker.addEventListener("controllerchange",onController);
    return()=>navigator.serviceWorker.removeEventListener("controllerchange",onController);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);
  useEffect(()=>{
    if(notifEnabled) sendScheduleToSW(days);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[notifEnabled,JSON.stringify(days.map(d=>d.activities?.map(a=>({t:a.time,n:a.name}))))]);
  // ── Budget limit persist ───────────────────────────────────────────────────
  function saveBudgetLimit(v){
    const n=Number(v);
    const limit=isNaN(n)||n<=0?null:n;
    setBudgetLimit(limit);
    try{localStorage.setItem("tm_budget_limit",String(n));}catch(_){}
    if(limit){
      const tb=computeTripBudget(days);
      if(tb.total>limit){
        // Actually remove/downgrade expensive items across all days to fit the limit
        replaceDays(prev=>adjustDaysToBudget(prev,limit));
      }
    }
  }
  function saveDayBudgetLimit(v){
    const n=Number(v);
    const limit=isNaN(n)||n<=0?null:n;
    setDayBudgetLimit(limit);
    try{localStorage.setItem("tm_day_budget_limit",String(n));}catch(_){}
    if(limit){
      const db=computeDayBudget(days[activeDay]||{});
      if(db.total>limit){
        // Actually remove/downgrade expensive items in today's day to fit the limit
        replaceDays(prev=>prev.map((d,i)=>i!==activeDay?d:adjustDayToBudget(d,limit)));
      }
    }
  }
  // ── Budget replan on-demand ────────────────────────────────────────────────
  const [budgetReplanDone,setBudgetReplanDone]=useState(null); // "day"|"trip"|null
  function replanDayToBudget(){
    if(!dayBudgetLimit) return;
    replaceDays(prev=>prev.map((d,i)=>i!==activeDay?d:adjustDayToBudget(d,dayBudgetLimit)));
    setBudgetReplanDone("day");
    setTimeout(()=>setBudgetReplanDone(null),2500);
  }
  function replanTripToBudget(){
    if(!budgetLimit) return;
    replaceDays(prev=>adjustDaysToBudget(prev,budgetLimit));
    setBudgetReplanDone("trip");
    setTimeout(()=>setBudgetReplanDone(null),2500);
  }
  // ── Group Supabase sync ────────────────────────────────────────────────────
  const groupSyncTimer=useRef(null);
  useEffect(()=>{
    if(!cloudEnabled||!tripId) return;
    const {url:sbUrl,key:sbKey}=getSbConfig();
    clearTimeout(groupSyncTimer.current);
    groupSyncTimer.current=setTimeout(async()=>{
      try{await fetch(`${sbUrl}/rest/v1/trips?id=eq.${encodeURIComponent(tripId)}`,{method:"PATCH",headers:sbHeaders(sbKey),body:JSON.stringify({group_state:groupState,updated_at:new Date().toISOString()})});}catch(_){}
    },1500);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[JSON.stringify(groupState),cloudEnabled,tripId]);
  useEffect(()=>{
    if(!cloudEnabled||!tripId) return;
    const {url:sbUrl,key:sbKey}=getSbConfig();
    let active=true; let etag="";
    async function pollGroup(){
      try{
        const res=await fetch(`${sbUrl}/rest/v1/trips?id=eq.${encodeURIComponent(tripId)}&select=group_state`,{headers:{...sbHeaders(sbKey),"If-None-Match":etag}});
        if(res.ok){etag=res.headers.get("etag")||"";const rows=await res.json();if(rows[0]?.group_state?.members){setGroupState(gs=>{const incoming=rows[0].group_state;return JSON.stringify(gs)===JSON.stringify(incoming)?gs:incoming;});}}
      }catch(_){}
      if(active) setTimeout(pollGroup,10000);
    }
    setTimeout(pollGroup,5000);
    return()=>{active=false;};
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[cloudEnabled,tripId]);
  // ── Realtime state ─────────────────────────────────────────────────────────
  // Live mode always on — no toggle needed
  useRealtimeTripUpdates({enabled:true,intervalMs:60000,setDays:setDaysLocal});
  function refreshRealtimeNow(){
    setDaysLocal(prev=>prev.map((d,i)=>i===activeDay?updateDayInRealtime(d,new Date()):d));
  }
  // ── Live trip control ──────────────────────────────────────────────────────
  const lateRisk=detectLateRisk(days[activeDay],userLoc,form.transport||"mixed");
  const {actions:controlActions}=getRealtimeControlActions(days[activeDay],userLoc,form.transport||"mixed");
  function refreshLiveControl(){ setDaysLocal(prev=>[...prev]); }
  function handleDelayRemaining(delayMinutes){
    replaceDays(prev=>prev.map((d,i)=>i===activeDay?delayRemainingActivities(d,delayMinutes):d));
  }
  function handleSkipNextStop(){
    const next=lateRisk?.nextActivity; if(!next) return;
    replaceDays(prev=>prev.map((d,i)=>i===activeDay?skipActivity(d,next._id||next.name):d));
  }
  function handleRebuildRestOfDay(){
    replaceDays(prev=>prev.map((d,i)=>i===activeDay?rebuildRestOfDay(d):d));
  }
  // ── Weather fallback state ─────────────────────────────────────────────────
  const [selectedWeatherActivityId,setSelectedWeatherActivityId]=useState(null);
  const [weatherFallbackOptions,setWeatherFallbackOptions]=useState([]);
  const selectedWeatherActivity=(days[activeDay]?.activities||[]).find(a=>(a._id||a.name)===selectedWeatherActivityId)||null;
  const fallbackCandidatePool=[...(hiddenGemResults||[]),...(placesResults||[]),...((conciergeReply?.suggestions||[]).map(s=>({...s,_id:s._id||s.name})))];
  function generateWeatherFallbacksForSelectedActivity(){
    if(!selectedWeatherActivity) return;
    setWeatherFallbackOptions(buildWeatherFallbackOptions({originalActivity:selectedWeatherActivity,candidatePlaces:fallbackCandidatePool,weatherForecast:days[activeDay]?.weatherForecast||"",interests:form.interests||[],maxResults:4}));
  }
  function handleAddWeatherAlternative(fallback){
    replaceDays(prev=>prev.map((d,i)=>i===activeDay?addFallbackAsAlternative(d,fallback):d));
  }
  function handleReplaceWithWeatherFallback(fallback){
    replaceDays(prev=>prev.map((d,i)=>i===activeDay?replaceActivityWithFallback(d,fallback):d));
    setWeatherFallbackOptions(prev=>prev.filter(f=>(f._id||f.name)!==(fallback._id||fallback.name)));
  }
  function handleDismissWeatherFallback(fallbackId){
    setWeatherFallbackOptions(prev=>prev.filter(f=>(f._id||f.name)!==fallbackId));
    replaceDays(prev=>prev.map((d,i)=>i===activeDay?dismissFallback(d,fallbackId):d));
  }
  // Auto rain-proof days that have real rainy weather data
  useEffect(()=>{
    replaceDays(prev=>prev.map(d=>{
      if(!d._realWeather?.rain) return d;
      return optimizeDayPlan(replaceOutdoorForRain(d),form,prev.length);
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);
  const ws=weatherStyle(day.weatherForecast);

  return(
    <div style={{minHeight:"100vh",background:"var(--tm-surface)",color:"var(--tm-text)",fontFamily:"inherit"}}>
      <style>{CSS}</style>
      {showAdd&&<AddModal onClose={()=>setShowAdd(false)} onAdd={addAct} destination={data.destination} placesQuery={placesQuery} setPlacesQuery={setPlacesQuery} placesResults={placesResults} placesLoading={placesLoading} onRunPlacesSearch={runPlacesSearch} onAddPlace={addPlaceResultToDay}/>}
      {showExport&&<ExportModal onClose={()=>setShowExport(false)} data={data} form={form} days={days}/>}
      {/* Nav */}
      <div style={{position:"sticky",top:0,zIndex:100,background:"rgba(255,255,255,.97)",backdropFilter:"blur(10px)",borderBottom:"1px solid var(--tm-border)"}}>
        <div style={{maxWidth:740,margin:"0 auto",height:54,display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,padding:"0 14px"}}>
          <button onClick={()=>{handleSave();onBack();}} style={{background:"none",border:"none",color:"var(--tm-text)",fontSize:".9rem",fontFamily:"inherit",padding:"8px 4px",minWidth:56}}>← Back</button>
          <div style={{fontWeight:900,fontSize:".92rem",color:"var(--tm-text)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:200}}>{data.destination}</div>
          <div style={{display:"flex",gap:5,alignItems:"center"}}>
            {syncStatus==="syncing"&&<span style={{fontSize:".62rem",color:"var(--tm-text3)",display:"flex",alignItems:"center",gap:3,whiteSpace:"nowrap"}}><Spin size={10}/> Saving…</span>}
            {syncStatus==="synced"&&<span style={{fontSize:".62rem",color:"var(--tm-text3)",whiteSpace:"nowrap"}}>✓ Synced</span>}
            {syncStatus==="error"&&<span title={syncError} style={{fontSize:".62rem",color:"#dc2626",whiteSpace:"nowrap"}}>⚠ Sync error</span>}
            <button title="Undo (Ctrl+Z)" disabled={undoCount===0} onClick={()=>{const prev=undoStackRef.current[undoStackRef.current.length-1];if(!prev)return;undoStackRef.current=undoStackRef.current.slice(0,-1);setUndoCount(undoStackRef.current.length);replaceDays(()=>prev);}} style={{padding:"5px 8px",borderRadius:7,border:"1px solid var(--tm-border2)",background:undoCount>0?"#fff":"#f5f5f5",color:undoCount>0?"#111":"#bbb",fontSize:".72rem",fontFamily:"inherit",fontWeight:700,minHeight:30,cursor:undoCount>0?"pointer":"not-allowed",opacity:undoCount>0?1:0.5}}>↩{undoCount>0?` ${undoCount}`:""}</button>
            {/* Three-dot menu */}
            <div style={{position:"relative"}}>
              <button onClick={()=>setShowTripMenu(v=>!v)} style={{width:36,height:36,borderRadius:"50%",border:"1px solid var(--tm-border2)",background:showTripMenu?"#F2F2F2":"#fff",color:"var(--tm-text)",fontSize:"1.2rem",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontFamily:"inherit",lineHeight:1,letterSpacing:".05em"}}>⋯</button>
              {showTripMenu&&<>
                <div onClick={()=>setShowTripMenu(false)} style={{position:"fixed",inset:0,zIndex:199}}/>
                <div style={{position:"absolute",top:"calc(100% + 6px)",right:0,zIndex:200,background:"var(--tm-bg)",borderRadius:12,boxShadow:"0 6px 24px rgba(47,65,86,.18)",border:"1px solid #E2EBF0",minWidth:180,overflow:"hidden"}}>
                  <button onClick={()=>{exportPDFLike();setShowTripMenu(false);}} style={{width:"100%",padding:"13px 16px",background:"none",border:"none",borderBottom:"1px solid #F0F4F7",textAlign:"left",cursor:"pointer",fontFamily:"inherit",fontSize:".88rem",color:"var(--tm-text)",fontWeight:600,display:"flex",alignItems:"center",gap:10}}>
                    <span style={{fontSize:"1rem"}}>📄</span> Als PDF speichern
                  </button>
                  <button onClick={()=>{shareCurrentTrip();setShowTripMenu(false);}} style={{width:"100%",padding:"13px 16px",background:"none",border:"none",textAlign:"left",cursor:"pointer",fontFamily:"inherit",fontSize:".88rem",color:"var(--tm-text)",fontWeight:600,display:"flex",alignItems:"center",gap:10}}>
                    <span style={{fontSize:"1rem"}}>🔗</span> Teilen
                  </button>
                </div>
              </>}
            </div>
          </div>
        </div>
      </div>
      {/* Hero - picsum gives a real photo */}
      {/* ── Hero — taller, melts into background ── */}
      <DestPhotoBg dest={data.destination} style={{position:"relative",height:280,overflow:"hidden",backgroundColor:"#111"}}>
        {/* Dark overlay */}
        <div style={{position:"absolute",inset:0,background:"linear-gradient(to bottom,rgba(0,0,0,.05) 0%,rgba(0,0,0,.62) 65%,rgba(247,247,247,1) 100%)"}}/>
        <div style={{position:"absolute",bottom:20,left:18,right:18,color:"#fff"}}>
          <h2 style={{fontSize:"clamp(1.7rem,5vw,2.4rem)",fontWeight:900,letterSpacing:"-.03em",textShadow:"0 2px 12px rgba(0,0,0,.5)",lineHeight:1.05,marginBottom:4}}>{data.destination}</h2>
          {data.tagline&&<p style={{fontSize:".85rem",opacity:.82,textShadow:"0 1px 4px rgba(0,0,0,.5)",marginBottom:10,lineHeight:1.4}}>{data.tagline}</p>}
          {/* Traveller avatars */}
          {(data.members?.length>0)&&<div style={{display:"flex",alignItems:"center",gap:6}}>
            <div style={{display:"flex"}}>
              {(data.members||[]).slice(0,6).map((m,idx)=>(
                <div key={idx} title={m.name} style={{width:26,height:26,borderRadius:"50%",background:"#111",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:".68rem",fontWeight:700,border:"2px solid rgba(255,255,255,.75)",marginLeft:idx>0?-7:0,zIndex:10-idx,flexShrink:0}}>
                  {m.avatar||(m.name||"?")[0].toUpperCase()}
                </div>
              ))}
              <button onClick={()=>{
                const url=window.location.origin+window.location.pathname+"?joinTrip="+(data.id||Date.now());
                localStorage.setItem("tm_invite_"+(data.id||Date.now()),JSON.stringify({...data,id:data.id||Date.now()}));
                navigator.clipboard?.writeText(url).then(()=>alert("Invite link copied!")).catch(()=>prompt("Copy this link:",url));
              }} title="Freunde einladen" style={{width:26,height:26,borderRadius:"50%",background:"rgba(255,255,255,.15)",border:"2px dashed rgba(255,255,255,.55)",marginLeft:-7,color:"#fff",fontSize:".95rem",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",backdropFilter:"blur(4px)"}}>+</button>
            </div>
            <span style={{fontSize:".66rem",color:"rgba(255,255,255,.75)",fontWeight:600}}>{data.members.length} dabei</span>
          </div>}
        </div>
      </DestPhotoBg>
      <div style={{maxWidth:740,margin:"0 auto",padding:"0 0 60px"}}>
        {/* ── Info pills — scrollable row ── */}
        <div className="sx" style={{padding:"12px 14px 8px",gap:7,display:"flex",alignItems:"center"}}>
          {data.currency&&<span style={{fontSize:".74rem",padding:"5px 12px",background:"var(--tm-bg)",border:"1px solid var(--tm-border2)",borderRadius:99,color:"var(--tm-text)",flexShrink:0,whiteSpace:"nowrap"}}>{data.currency}</span>}
          {data.language&&<span style={{fontSize:".74rem",padding:"5px 12px",background:"var(--tm-bg)",border:"1px solid var(--tm-border2)",borderRadius:99,color:"var(--tm-text)",flexShrink:0,whiteSpace:"nowrap"}}>{data.language}</span>}
          {data.emergency&&<span style={{fontSize:".74rem",padding:"5px 12px",background:"#fef2f2",border:"1px solid #fecaca",borderRadius:99,color:"#dc2626",flexShrink:0,whiteSpace:"nowrap"}}>{data.emergency}</span>}
          <span style={{fontSize:".74rem",padding:"5px 12px",background:"#111",border:"none",borderRadius:99,color:"#fff",flexShrink:0,whiteSpace:"nowrap",fontWeight:700}}>{totalDays} Days</span>
          {data.weatherNote&&<span style={{fontSize:".74rem",padding:"5px 12px",background:"var(--tm-bg)",border:"1px solid var(--tm-border2)",borderRadius:99,color:"var(--tm-text)",flexShrink:0,whiteSpace:"nowrap"}}>{data.weatherNote}</span>}
          {data.transportInfo&&<button onClick={()=>setShowTransportSheet(true)} style={{fontSize:".74rem",padding:"5px 12px",background:"#111",border:"none",borderRadius:99,color:"#fff",flexShrink:0,whiteSpace:"nowrap",cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>Transport</button>}
        </div>

        {/* ── Day chips — horizontal scrollable strip ── */}
        <div className="sx" style={{padding:"4px 14px 10px",gap:6,display:"flex",alignItems:"center"}}>
          {days.map((d,i)=>{
            const wx=d.weatherForecast?d.weatherForecast.trim().split(" ")[0]:"";
            const isActive=i===activeDay;
            return(
              <button key={i} onClick={()=>{setActiveDay(i);setTab("plan");}}
                style={{flexShrink:0,minWidth:56,padding:"7px 13px",borderRadius:99,fontFamily:"inherit",cursor:"pointer",border:"1.5px solid "+(isActive?"#111":"var(--tm-border2)"),background:isActive?"#111":"#fff",color:isActive?"#fff":"#111",fontWeight:isActive?800:500,fontSize:".78rem",boxShadow:isActive?"0 3px 10px rgba(0,0,0,.15)":"none",transition:"all .18s",display:"flex",flexDirection:"column",alignItems:"center",gap:1,lineHeight:1}}>
                {wx&&<span style={{fontSize:".72rem",lineHeight:1,marginBottom:1,opacity:isActive?1:.7}}>{wx}</span>}
                <span>T{d.day||i+1}</span>
              </button>
            );
          })}
        </div>

        {/* ── Sub-tabs ── */}
        <div style={{display:"flex",alignItems:"center",borderBottom:"1.5px solid #EBEBEB",marginBottom:14,overflow:"hidden",padding:"0 14px"}}>
          <div style={{display:"flex",overflow:"hidden",flex:1}}>
            {[["plan","Plan"],["map","Map"],["ai","AI"],["group","Gruppe"],["tips","Tips"]].map(([id,l])=>(
              <button key={id} onClick={()=>setTab(id)} style={{padding:"11px 8px",minHeight:44,flex:1,background:"none",border:"none",borderBottom:tab===id?"2.5px solid #111":"2.5px solid transparent",marginBottom:"-1.5px",color:tab===id?"#111":"#888",fontSize:".8rem",fontFamily:"inherit",fontWeight:tab===id?700:400,whiteSpace:"nowrap",position:"relative",cursor:"pointer"}}>
                {l}
                {id==="group"&&getSuggestionsForDay(groupState,day.day||activeDay+1).filter(s=>s.status==="pending").length>0&&<span style={{position:"absolute",top:8,right:4,width:7,height:7,borderRadius:"50%",background:"#dc2626"}}/>}
              </button>
            ))}
          </div>
        </div>
        <div style={{padding:"0 14px"}}>
        {/* Plan */}
        {tab==="plan"&&<div className="fu">
          {/* ── Day header — clean typography ── */}
          {(()=>{
            const dayBudget=computeDayBudget(day);
            const overDay=dayBudgetLimit&&dayBudget.total>dayBudgetLimit;
            const pill={fontSize:".72rem",padding:"4px 10px",borderRadius:99,background:"var(--tm-bg)",border:"1px solid var(--tm-border2)",color:"var(--tm-text)",whiteSpace:"nowrap",flexShrink:0};
            return(
              <div style={{marginBottom:16}}>
                <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8,marginBottom:8}}>
                  <h3 style={{fontSize:"1.45rem",fontWeight:900,color:"var(--tm-text)",letterSpacing:"-.03em",lineHeight:1.1,flex:1,margin:0}}>
                    {day.theme||`Tag ${day.day}`}
                  </h3>
                  <button onClick={()=>setShowPersonalityPicker(true)} disabled={regenLoading}
                    style={{flexShrink:0,padding:"7px 12px",borderRadius:99,border:"1.5px solid var(--tm-border)",background:"var(--tm-bg)",color:regenLoading?"#8A9CAA":"#555",fontSize:".72rem",fontWeight:700,fontFamily:"inherit",cursor:regenLoading?"default":"pointer",display:"flex",alignItems:"center",gap:5,boxShadow:"0 1px 4px rgba(47,65,86,.08)"}}>
                    {regenLoading
                      ?<><span style={{display:"inline-block",width:10,height:10,border:"2px solid var(--tm-border)",borderTopColor:"#555",borderRadius:"50%",animation:"spin 0.7s linear infinite"}}/>…</>
                      :<>⚙ {TRIP_PERSONALITIES[personalityId]?.label?.split(" ").slice(0,2).join(" ")||"Explorer"}</>}
                  </button>
                </div>
                <div style={{display:"flex",flexWrap:"wrap",gap:6,alignItems:"center"}}>
                  {day.neighborhood&&<span style={pill}>📍 {day.neighborhood}</span>}
                  {day.weatherForecast&&<span style={pill}>{day.weatherForecast}</span>}
                  {day.timeWindow&&<span style={pill}>⏰ {day.timeWindow}</span>}
                  {day._realWeather&&<span style={{...pill,background:"var(--tm-surface2)",border:"1px solid var(--tm-border)",color:"var(--tm-text)"}}>🌡 Live</span>}
                  {dayBudget.total>0&&<button onClick={()=>setShowBudgetSheet(true)}
                    style={{...pill,cursor:"pointer",background:overDay?"#fef2f2":"#fff",border:"1px solid "+(overDay?"#fecaca":"var(--tm-border)"),color:overDay?"#dc2626":"#555",fontFamily:"inherit"}}>
                    💰 €{dayBudget.total.toFixed(0)}{overDay?" ⚠":""}
                  </button>}
                  {overDay&&<button onClick={replanDayToBudget}
                    style={{...pill,cursor:"pointer",background:"#dc2626",border:"none",color:"#fff",fontFamily:"inherit",fontWeight:800}}>
                    ✂️ Neu planen
                  </button>}
                  <button onClick={()=>setShowNotifPanel(true)}
                    title="Erinnerungen verwalten"
                    style={{...pill,cursor:"pointer",background:notifEnabled?"#F0FDF4":"#fff",border:"1px solid "+(notifEnabled?"#86EFAC":"var(--tm-border)"),color:notifEnabled?"#16a34a":"#555",fontFamily:"inherit",fontWeight:700}}>
                    {notifEnabled?"🔔":"🔕"}
                  </button>
                  <button onClick={optimizeCurrentDay}
                    style={{...pill,cursor:"pointer",background:"#111",border:"none",color:"#fff",fontFamily:"inherit",fontWeight:700}}>
                    🔀
                  </button>
                </div>
              </div>
            );
          })()}

          {/* ── Weather Alert Banner ── */}
          {(()=>{
            const isRainy=weatherLooksRainy(day.weatherForecast);
            const isCold=weatherLooksCold(day.weatherForecast);
            const isHot=weatherLooksHot(day.weatherForecast);
            if(!isRainy&&!isCold&&!isHot) return null;
            const affectedActs=(acts||[]).filter(a=>isOutdoorActivity(a)&&!a.locked);
            const icon=isRainy?"🌧":isCold?"🥶":"🌡";
            const label=isRainy?"Regen erwartet":isCold?"Kalt — unter 8°C":"Heiß — über 28°C";
            const bg=isRainy?"linear-gradient(135deg,#EBF4FF,#E8F0FE)":isCold?"linear-gradient(135deg,#EEF6FF,#E8F0FF)":"linear-gradient(135deg,#FFF7ED,#FEF3E2)";
            const borderColor=isRainy?"#BFDBFE":isCold?"#BFDBFE":"#FED7AA";
            const textColor=isRainy?"#1E40AF":isCold?"#1E3A8A":"#92400E";
            const btnBg=isRainy?"#1E40AF":isCold?"#1E3A8A":"#92400E";
            return(
              <div style={{borderRadius:14,overflow:"hidden",marginBottom:14,border:"1.5px solid "+borderColor,background:bg}}>
                <div style={{padding:"13px 16px",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                  <span style={{fontSize:"1.6rem",flexShrink:0}}>{icon}</span>
                  <div className="tm-flex1">
                    <div style={{fontWeight:800,fontSize:".95rem",color:textColor}}>{label}</div>
                    <div style={{fontSize:".75rem",color:textColor,opacity:.8,marginTop:1}}>{day.weatherForecast}{affectedActs.length>0?" · "+affectedActs.length+" "+(affectedActs.length===1?T("outdoorAffected"):T("outdoorAffectedPlural")):""}</div>
                  </div>
                  {isRainy&&affectedActs.length>0&&<button onClick={rainProof} style={{padding:"9px 14px",borderRadius:10,border:"none",background:btnBg,color:"#fff",fontWeight:700,fontSize:".78rem",fontFamily:"inherit",cursor:"pointer",whiteSpace:"nowrap",flexShrink:0}}>
                    {T("rainPlan")}
                  </button>}
                </div>
                {affectedActs.length>0&&<div style={{padding:"0 16px 12px",display:"flex",gap:6,flexWrap:"wrap"}}>
                  {affectedActs.map(a=>(
                    <span key={a._id||a.name} style={{fontSize:".7rem",padding:"3px 9px",borderRadius:99,background:"rgba(30,64,175,.1)",color:textColor,border:"1px solid "+borderColor,fontWeight:600}}>
                      ⛅ {a.name}
                    </span>
                  ))}
                </div>}
              </div>
            );
          })()}

          {/* ── Live Mode: auto-runs when today's day is active ── */}
          {isLiveModeDay&&<div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:14}}>
            <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderRadius:12,background:"#dcfce7",border:"1.5px solid #86efac",flexWrap:"wrap"}}>
              <span style={{display:"inline-block",width:9,height:9,borderRadius:"50%",background:"#22c55e",animation:"pulse 1.2s infinite",flexShrink:0}}/>
              <span style={{fontWeight:800,fontSize:".84rem",color:"#15803d"}}>{T("liveMode")}</span>
              <span style={{fontSize:".76rem",color:"#166534",opacity:.8}}>— Echtzeit-Updates für heute.</span>
              {nextStopAct&&<span style={{marginLeft:"auto",fontSize:".74rem",fontWeight:700,background:"var(--tm-bg)",border:"1px solid #86efac",color:"#15803d",borderRadius:20,padding:"2px 10px",whiteSpace:"nowrap"}}>
                {nextStopAct.liveStatus==="live"?"● Jetzt: ":"⏭ Nächstes: "}{nextStopAct.name}
              </span>}
            </div>
            <LiveTripControlPanel day={day} lateRisk={lateRisk} controlActions={controlActions} onDelay={handleDelayRemaining} onSkipNext={handleSkipNextStop} onRebuild={handleRebuildRestOfDay} onRefresh={refreshLiveControl}/>
          </div>}

          {/* ── Weather Fallback Panel ── only when rainy + outdoor activities exist ── */}
          {weatherLooksRainy(day.weatherForecast)&&(acts||[]).some(a=>isOutdoorActivity(a)&&!a.locked)&&(
            <div style={{background:"var(--tm-bg)",border:"1.5px solid #BFDBFE",borderRadius:14,padding:16,marginBottom:14}}>
              <div style={{fontWeight:800,fontSize:".95rem",color:"#1E40AF",marginBottom:4}}>🏠 Drinnen-Alternativen</div>
              <div style={{fontSize:".78rem",color:"#3B82F6",marginBottom:12}}>{T("chooseOutdoor")}</div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>
                {(acts||[]).filter(a=>isOutdoorActivity(a)&&!a.locked).map(a=>(
                  <button key={a._id||a.name}
                    onClick={()=>{
                      setSelectedWeatherActivityId(a._id||a.name);
                      setWeatherFallbackOptions(buildWeatherFallbackOptions({originalActivity:a,candidatePlaces:fallbackCandidatePool,weatherForecast:day.weatherForecast,interests:form.interests||[],maxResults:4}));
                    }}
                    style={{padding:"7px 12px",borderRadius:10,border:"1.5px solid "+(selectedWeatherActivityId===(a._id||a.name)?"#1E40AF":"#BFDBFE"),background:selectedWeatherActivityId===(a._id||a.name)?"#1E40AF":"#EFF6FF",color:selectedWeatherActivityId===(a._id||a.name)?"#fff":"#1E40AF",fontWeight:700,fontSize:".78rem",fontFamily:"inherit",cursor:"pointer"}}>
                    ⛅ {a.name}
                  </button>
                ))}
              </div>
              {selectedWeatherActivity&&<WeatherFallbackPanel
                weatherForecast={day.weatherForecast}
                selectedActivity={selectedWeatherActivity}
                fallbackOptions={weatherFallbackOptions}
                onAddAlternative={handleAddWeatherAlternative}
                onReplaceWithFallback={handleReplaceWithWeatherFallback}
                onDismiss={handleDismissWeatherFallback}
              />}
              {selectedWeatherActivity&&weatherFallbackOptions.length===0&&(
                <div style={{fontSize:".8rem",color:"#3B82F6",padding:"10px 0",textAlign:"center"}}>
                  Keine Alternativen im Pool — suche zuerst nach Orten unter „Add Real Places" 🔍
                </div>
              )}
            </div>
          )}

          {/* ── Add Real Places ── */}
          {(()=>{
            const gemContext={interests:form.interests,style:form.style,period:"afternoon",weatherForecast:day.weatherForecast,existingActivities:acts};
            const displayResults=gemsMode&&placesResults.length>0?selectTopHiddenGems(placesResults,gemContext,6):placesResults;
            return(
            <div style={{background:"var(--tm-bg)",border:"1px solid var(--tm-border)",borderRadius:12,padding:14,marginBottom:14}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                <div className="tm-xbold">Add Real Places</div>
              </div>
              <div style={{display:"flex",gap:8,marginBottom:10}}>
                <input value={placesQuery} onChange={e=>setPlacesQuery(e.target.value)} placeholder="museum, rooftop bar, brunch, spa..." style={{flex:1,padding:"10px 12px",borderRadius:10,border:"1px solid var(--tm-border)",fontFamily:"inherit",fontSize:"16px"}}/>
                <button onClick={runPlacesSearch} style={{padding:"10px 14px",borderRadius:10,border:"none",background:"#111",color:"#fff",fontWeight:700,fontFamily:"inherit"}}>{placesLoading?"Searching...":"Search"}</button>
              </div>
              <div className="tm-grid tm-gap8">
                {displayResults.map(p=>(
                  <div key={p._id||p.name} style={{border:"1px solid var(--tm-border)",borderRadius:10,padding:12,background:"var(--tm-bg)"}}>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <div style={{fontWeight:800,flex:1,color:"var(--tm-text)"}}>{p.name}</div>
                    </div>
                    <div style={{fontSize:".8rem",color:"var(--tm-text2)",marginTop:4}}>{p.address}</div>
                    {p.tip&&<div style={{fontSize:".75rem",color:"var(--tm-text2)",marginTop:4,fontStyle:"italic"}}>{p.tip}</div>}
                    {p.openHours&&<div style={{fontSize:".75rem",color:"var(--tm-text3)",marginTop:4}}>{p.openHours}</div>}
                    <button onClick={()=>addPlaceResultToDay(p)} style={{marginTop:8,padding:"8px 12px",borderRadius:8,border:"none",background:"#111",color:"#fff",fontWeight:700,fontFamily:"inherit"}}>Add to day</button>
                  </div>
                ))}
              </div>
            </div>
            );
          })()}

          {/* ── Activities: drag-sortable vertical list with lock ── */}
          {(()=>{
            const conflicts=detectTimeConflicts(acts);
            const conflictAt=new Set(conflicts.map(c=>c.indexB));
            return(
          <div style={{position:"relative"}}>
          {/* Loading overlay while personality regen is running */}
          {regenLoading&&(
            <div style={{position:"absolute",inset:0,zIndex:20,borderRadius:14,background:"rgba(249,247,245,.88)",backdropFilter:"blur(3px)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:12,minHeight:160}}>
              <div style={{width:36,height:36,border:"4px solid var(--tm-border)",borderTopColor:"#111",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
              <div style={{fontWeight:700,color:"var(--tm-text)",fontSize:".9rem"}}>Regenerating activities…</div>
              <div style={{fontSize:".78rem",color:"var(--tm-text2)"}}>Crafting a {TRIP_PERSONALITIES[personalityId]?.label||""} day for you</div>
            </div>
          )}
          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>
            <button onClick={optimizeCurrentDayRoute} disabled={routeLoading} style={{padding:"10px 14px",borderRadius:10,border:"none",background:"#111",color:"#fff",fontWeight:700,fontFamily:"inherit",opacity:routeLoading?.6:1}}>{routeLoading?"Optimizing...":"Optimize Route"}</button>
          </div>
          {acts.map((a,i)=>{
            const actId=a._id||a.name;
            const isEditing=editingActId===actId;
            const conflict=conflicts.find(c=>c.indexB===i);
            const isNextStop=isLiveModeDay&&actId===nextStopId;
            const isLiveNow=isLiveModeDay&&a.liveStatus==="live";
            const isPastAct=isLiveModeDay&&(a.liveStatus==="missed_or_done"||a.liveStatus==="just_finished");
            return(
            <div key={actId} ref={el=>actCardRefs.current[actId]=el}>
              {conflict&&<div style={{display:"flex",alignItems:"center",gap:8,padding:"6px 10px",margin:"4px 0",background:"#fef9c3",border:"1px solid #fde047",borderRadius:8,fontSize:".74rem",color:"#92400e",fontWeight:600}}>
                ⚠ Conflict: {conflict.nameA} runs {conflict.overlapMins} min into {conflict.nameB}
              </div>}
              <div draggable
                data-actidx={i}
                onDragStart={()=>onDragStart(i)}
                onDragOver={e=>e.preventDefault()}
                onDrop={()=>onDropAt(i)}
                onDragEnd={onDragEnd}
                onTouchStart={e=>onActTouchStart(e,i)}
                onTouchMove={onActTouchMove}
                onTouchEnd={onActTouchEnd}
                style={{marginBottom:10,borderRadius:12,
                  opacity:dragIndex===i?.4:isPastAct?.62:1,
                  filter:isPastAct?"grayscale(25%)":"none",
                  transition:"opacity .15s,filter .15s,transform .12s,outline .1s",
                  cursor:"default",
                  transform:dragIndex===i?"scale(0.96)":"scale(1)",
                  outline:isLiveNow?"2.5px solid #22c55e":isNextStop?"2.5px solid #d97706":dragOverIndex===i&&dragIndex!==i?"2.5px dashed #555":"none",
                  outlineOffset:2}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:6,flexWrap:"wrap",gap:4}}>
                  <div style={{fontSize:".75rem",color:"var(--tm-text2)"}}>{a.travelLabelFromPrev?`Travel: ${a.travelLabelFromPrev}`:""}</div>
                  <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
                    {/* Visited toggle */}
                    <button onClick={()=>toggleVisited(actId)} title={a._visited?"Mark as not visited":"Mark as visited"} style={{padding:"5px 8px",borderRadius:8,border:"1.5px solid "+(a._visited?"#22c55e":"var(--tm-border)"),background:a._visited?"#dcfce7":"#fff",color:a._visited?"#16a34a":"#8A9CAA",fontWeight:700,fontFamily:"inherit",fontSize:".72rem",minHeight:30}}>
                      {a._visited?"✓ Done":"○ Not done"}
                    </button>
                    {/* Star rating (only when visited) */}
                    {a._visited&&<div style={{display:"flex",gap:1}}>{[1,2,3,4,5].map(s=><button key={s} onClick={()=>setRating(actId,s)} style={{background:"none",border:"none",cursor:"pointer",fontSize:".95rem",color:s<=(a._rating||0)?"#f59e0b":"var(--tm-border)",padding:"0 1px",lineHeight:1}}>★</button>)}</div>}
                    <span title="Drag to reorder" style={{fontSize:"1.1rem",color:"var(--tm-border)",cursor:"grab",userSelect:"none",touchAction:"none",letterSpacing:"-.5px",lineHeight:1}}>⠿</span>
                    <button onClick={()=>isEditing?setEditingActId(null):startEditAct(a)} style={{padding:"5px 8px",borderRadius:8,border:"1px solid var(--tm-border)",background:isEditing?"#111":"#fff",color:isEditing?"#fff":"#111",fontWeight:700,fontFamily:"inherit",fontSize:".72rem",minHeight:30}}>✏️ Edit</button>
                    <button onClick={()=>lockActivity(actId)} style={{padding:"5px 8px",borderRadius:8,border:"1px solid var(--tm-border)",background:a.locked?"#111":"#fff",color:a.locked?"#fff":"#111",fontWeight:700,fontFamily:"inherit",fontSize:".72rem",minHeight:30}}>
                      {a.locked?"🔒":"🔓"}
                    </button>
                    {days.length>1&&<button onClick={()=>setMovingAct({actId,fromDay:activeDay})}
                      title="Zu anderem Tag verschieben"
                      style={{padding:"5px 8px",borderRadius:8,border:"1px solid var(--tm-border)",background:"var(--tm-bg)",color:"var(--tm-text)",fontWeight:700,fontFamily:"inherit",fontSize:".72rem",minHeight:30}}>
                      📅 Move
                    </button>}
                  </div>
                </div>
                {/* ── Live Mode banner ── */}
                {isLiveNow&&<div style={{display:"flex",alignItems:"center",gap:8,padding:"6px 12px",marginBottom:6,borderRadius:8,background:"#dcfce7",border:"1px solid #86efac"}}>
                  <span style={{display:"inline-block",width:8,height:8,borderRadius:"50%",background:"#22c55e",animation:"pulse 1.2s infinite"}}/>
                  <span style={{fontWeight:800,fontSize:".78rem",color:"#15803d"}}>● Live jetzt</span>
                  {a.time&&<span style={{fontSize:".72rem",color:"#16a34a",marginLeft:"auto"}}>ab {a.time}</span>}
                </div>}
                {isNextStop&&!isLiveNow&&<div style={{display:"flex",alignItems:"center",gap:8,padding:"6px 12px",marginBottom:6,borderRadius:8,background:"#fef9ec",border:"1px solid #fcd34d"}}>
                  <span style={{fontWeight:800,fontSize:".78rem",color:"#b45309"}}>⏭ Nächster Halt</span>
                  {a.time&&<span style={{fontSize:".72rem",color:"#d97706",marginLeft:"auto"}}>um {a.time}</span>}
                </div>}
                <ActCard act={a} onRemove={removeAct} isFirst={i===0}/>
                {/* Inline editor */}
                {isEditing&&<div style={{background:"var(--tm-bg)",border:"1.5px solid #111",borderRadius:12,padding:14,marginTop:6,display:"grid",gap:8}}>
                  <div style={{fontWeight:700,fontSize:".82rem",color:"var(--tm-text)",marginBottom:2}}>Edit activity</div>
                  <input value={editDraft.name} onChange={e=>setEditDraft(d=>({...d,name:e.target.value}))} placeholder="Name" style={{padding:"8px 10px",borderRadius:9,border:"1px solid var(--tm-border)",fontFamily:"inherit",fontSize:".84rem"}}/>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                    <input value={editDraft.time} onChange={e=>setEditDraft(d=>({...d,time:e.target.value}))} placeholder="Time (HH:MM)" style={{padding:"8px 10px",borderRadius:9,border:"1px solid var(--tm-border)",fontFamily:"inherit",fontSize:".84rem"}}/>
                    <input value={editDraft.duration} onChange={e=>setEditDraft(d=>({...d,duration:e.target.value}))} placeholder="Duration (e.g. 2h)" style={{padding:"8px 10px",borderRadius:9,border:"1px solid var(--tm-border)",fontFamily:"inherit",fontSize:".84rem"}}/>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                    <input value={editDraft.type} onChange={e=>setEditDraft(d=>({...d,type:e.target.value}))} placeholder="Type (Museum, Bar…)" style={{padding:"8px 10px",borderRadius:9,border:"1px solid var(--tm-border)",fontFamily:"inherit",fontSize:".84rem"}}/>
                    <input value={editDraft.price} onChange={e=>setEditDraft(d=>({...d,price:e.target.value}))} placeholder="Price (€ or Free)" style={{padding:"8px 10px",borderRadius:9,border:"1px solid var(--tm-border)",fontFamily:"inherit",fontSize:".84rem"}}/>
                  </div>
                  <textarea value={editDraft.desc} onChange={e=>setEditDraft(d=>({...d,desc:e.target.value}))} placeholder="Description / notes" rows={2} style={{padding:"8px 10px",borderRadius:9,border:"1px solid var(--tm-border)",fontFamily:"inherit",resize:"none",fontSize:".84rem"}}/>
                  {/* Personal travel note */}
                  <textarea value={a._note||""} onChange={e=>setActNote(actId,e.target.value)} placeholder="Your travel note (private)…" rows={2} style={{padding:"8px 10px",borderRadius:9,border:"1px solid var(--tm-border)",fontFamily:"inherit",resize:"none",fontSize:".82rem",background:"#fafafa"}}/>
                  <div className="tm-flex tm-gap8">
                    <button onClick={saveEditAct} style={{flex:1,padding:"10px",borderRadius:9,border:"none",background:"#111",color:"#fff",fontWeight:700,fontFamily:"inherit"}}>Save changes</button>
                    <button onClick={()=>setEditingActId(null)} style={{padding:"10px 14px",borderRadius:9,border:"1px solid var(--tm-border)",background:"var(--tm-bg)",color:"var(--tm-text2)",fontWeight:700,fontFamily:"inherit"}}>Cancel</button>
                  </div>
                </div>}
                {/* Travel note display (when not editing) */}
                {!isEditing&&a._note&&<div style={{fontSize:".74rem",color:"var(--tm-text2)",fontStyle:"italic",marginTop:4,padding:"5px 9px",background:"var(--tm-surface2)",borderRadius:7}}>📝 {a._note}</div>}
                {/* ── Live Vote Bar — shown whenever ≥2 members are in the group ── */}
                {groupState.members.length>=2&&(()=>{
                  const dayNum=day.day||activeDay+1;
                  const voteData=(groupState.activityVotesByDay[String(dayNum)]||{})[actId]||{};
                  const myVote=voteData[currentUserId]||0;
                  const upVoters=Object.entries(voteData).filter(([,v])=>Number(v)>0).map(([mid])=>getMemberName(groupState,mid));
                  const downVoters=Object.entries(voteData).filter(([,v])=>Number(v)<0).map(([mid])=>getMemberName(groupState,mid));
                  const allVoters=[...upVoters,...downVoters];
                  const score=upVoters.length-downVoters.length;
                  return(
                    <div style={{display:"flex",alignItems:"center",gap:8,marginTop:10,paddingTop:10,borderTop:"1px solid var(--tm-border)",flexWrap:"wrap"}}>
                      {/* Upvote */}
                      <button onClick={()=>handleVoteExistingActivity(actId,myVote===1?0:1)}
                        style={{padding:"5px 12px",borderRadius:20,border:"1.5px solid",borderColor:myVote===1?"#111":"var(--tm-border)",background:myVote===1?"var(--tm-border)":"#fff",fontWeight:700,fontSize:".76rem",cursor:"pointer",transition:"all .15s"}}>
                        👍 {upVoters.length>0?upVoters.length:""}
                      </button>
                      {/* Downvote */}
                      <button onClick={()=>handleVoteExistingActivity(actId,myVote===-1?0:-1)}
                        style={{padding:"5px 12px",borderRadius:20,border:"1.5px solid",borderColor:myVote===-1?"#dc2626":"var(--tm-border)",background:myVote===-1?"#fee2e2":"#fff",fontWeight:700,fontSize:".76rem",cursor:"pointer",transition:"all .15s"}}>
                        👎 {downVoters.length>0?downVoters.length:""}
                      </button>
                      {/* Avatar row: who voted */}
                      {allVoters.length>0&&<div style={{display:"flex",alignItems:"center",gap:3}}>
                        {allVoters.slice(0,4).map((n,vi)=>(
                          <div key={vi} title={n}
                            style={{width:22,height:22,borderRadius:"50%",background:upVoters.includes(n)?"var(--tm-border)":"#fee2e2",border:"1.5px solid",borderColor:upVoters.includes(n)?"#555":"#fca5a5",display:"flex",alignItems:"center",justifyContent:"center",fontSize:".6rem",fontWeight:900,color:upVoters.includes(n)?"#111":"#dc2626"}}>
                            {n[0].toUpperCase()}
                          </div>
                        ))}
                        {allVoters.length>4&&<span style={{fontSize:".62rem",color:"var(--tm-text3)"}}>+{allVoters.length-4}</span>}
                        <span style={{fontSize:".7rem",color:"var(--tm-text3)",marginLeft:2}}>
                          {allVoters.length===1?allVoters[0]:allVoters.length===2?allVoters.join(" & "):allVoters[0]+" & "+(allVoters.length-1)+" weitere"}
                        </span>
                      </div>}
                      {/* Score badge */}
                      {score!==0&&<span style={{marginLeft:"auto",fontSize:".72rem",fontWeight:800,color:score>0?"#16a34a":"#dc2626",background:score>0?"#dcfce7":"#fee2e2",padding:"2px 9px",borderRadius:20}}>
                        {score>0?"+"+score:score}
                      </span>}
                    </div>
                  );
                })()}
              </div>
              {/* ── Live transit routing block ── */}
              {isNextStop&&(()=>{
                const gmUrl=buildTransitUrl(userLoc,a,data.destination);
                const localUrl=getLocalTransitUrl(data.destination);
                return(
                  <div style={{margin:"4px 0 12px 0",padding:"10px 14px",borderRadius:10,background:"var(--tm-surface)",border:"1.5px solid var(--tm-border)",display:"flex",flexWrap:"wrap",gap:8,alignItems:"center"}}>
                    <span style={{fontSize:".76rem",fontWeight:700,color:"var(--tm-text)",marginRight:4}}>🚌 So kommst du hin:</span>
                    {gmUrl&&<a href={gmUrl} target="_blank" rel="noopener noreferrer"
                      style={{padding:"6px 12px",borderRadius:8,background:"#111",color:"#fff",fontWeight:700,fontSize:".74rem",textDecoration:"none",display:"inline-flex",alignItems:"center",gap:5}}>
                      🗺 Google Maps Transit
                    </a>}
                    {localUrl&&<a href={localUrl} target="_blank" rel="noopener noreferrer"
                      style={{padding:"6px 12px",borderRadius:8,background:"var(--tm-bg)",border:"1px solid var(--tm-border)",color:"var(--tm-text2)",fontWeight:700,fontSize:".74rem",textDecoration:"none",display:"inline-flex",alignItems:"center",gap:5}}>
                      🚇 Lokaler ÖPNV
                    </a>}
                  </div>
                );
              })()}
            </div>
            );
          })}
          </div>
            );
          })()}
          {/* ── Inline Friend Suggestions — only in group trips ──────────────── */}
          {isGroupTrip&&(()=>{
            const dayNum=day.day||activeDay+1;
            const pending=getSuggestionsForDay(groupState,dayNum).filter(s=>s.status==="pending");
            if(!pending.length) return null;
            return(
              <div style={{marginBottom:14}}>
                <div style={{fontSize:".68rem",fontWeight:700,textTransform:"uppercase",letterSpacing:".1em",color:"var(--tm-text3)",marginBottom:8}}>👥 Vorschläge der Gruppe</div>
                {pending.map(s=>{
                  const myVote=s.votes?.[currentUserId]||0;
                  const upCount=Object.values(s.votes||{}).filter(v=>Number(v)>0).length;
                  const downCount=Object.values(s.votes||{}).filter(v=>Number(v)<0).length;
                  const suggestorName=getMemberName(groupState,s.createdBy);
                  const isMine=s.createdBy===currentUserId;
                  return(
                    <div key={s.id} style={{border:"1.5px dashed var(--tm-border)",borderRadius:12,padding:"12px 14px",marginBottom:8,background:"var(--tm-surface)",position:"relative"}}>
                      <div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"flex-start"}}>
                        <div style={{flex:1}}>
                          <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",marginBottom:4}}>
                            <span style={{fontWeight:800,fontSize:".88rem",color:"var(--tm-text)"}}>{s.title}</span>
                            {s.type&&<span style={{fontSize:".68rem",padding:"1px 7px",borderRadius:20,background:"var(--tm-surface2)",color:"var(--tm-text2)",fontWeight:600}}>{s.type}</span>}
                          </div>
                          <div className="tm-sm tm-c2">
                            💬 Vorgeschlagen von <b>{isMine?"dir":suggestorName}</b>
                          </div>
                          {s.notes&&<div style={{fontSize:".78rem",color:"var(--tm-text)",marginTop:5,lineHeight:1.4}}>{s.notes}</div>}
                        </div>
                        {/* Vote buttons */}
                        <div style={{display:"flex",flexDirection:"column",gap:5,alignItems:"flex-end",flexShrink:0}}>
                          <button onClick={()=>handleVoteSuggestion(s.id,myVote===1?0:1)}
                            style={{padding:"4px 10px",borderRadius:20,border:"1.5px solid",borderColor:myVote===1?"#111":"var(--tm-border)",background:myVote===1?"var(--tm-border)":"#fff",fontWeight:700,fontSize:".72rem",cursor:"pointer"}}>
                            👍 {upCount||""}
                          </button>
                          <button onClick={()=>handleVoteSuggestion(s.id,myVote===-1?0:-1)}
                            style={{padding:"4px 10px",borderRadius:20,border:"1.5px solid",borderColor:myVote===-1?"#dc2626":"var(--tm-border)",background:myVote===-1?"#fee2e2":"#fff",fontWeight:700,fontSize:".72rem",cursor:"pointer"}}>
                            👎 {downCount||""}
                          </button>
                        </div>
                      </div>
                      <div style={{display:"flex",gap:7,marginTop:10,flexWrap:"wrap"}}>
                        <button onClick={()=>{addAct({_id:uid(),name:s.title,type:s.type,desc:s.notes,_suggestedBy:suggestorName});handleSetSuggestionStatus(s.id,"approved");}}
                          style={{padding:"6px 12px",borderRadius:8,border:"none",background:"#111",color:"#fff",fontWeight:700,fontFamily:"inherit",fontSize:".75rem",cursor:"pointer"}}>
                          ✓ Zum Tag hinzufügen
                        </button>
                        {isMine&&<button onClick={()=>handleDeleteSuggestion(s.id)}
                          style={{padding:"6px 10px",borderRadius:8,border:"1px solid var(--tm-border)",background:"var(--tm-bg)",color:"var(--tm-text3)",fontWeight:700,fontFamily:"inherit",fontSize:".72rem",cursor:"pointer"}}>
                          Löschen
                        </button>}
                      </div>
                    </div>
                  );
                })}
                {/* Submit own suggestion — SuggestionInlineForm handles its own state */}
                <SuggestionInlineForm dayNum={dayNum} destination={data.destination} onSubmit={handleAddSuggestion}/>
              </div>
            );
          })()}

          {hiddenGemResults.length>0&&(
            <div style={{background:"var(--tm-bg)",border:"1px solid var(--tm-border)",borderRadius:14,padding:16,marginBottom:14}}>
              <div className="tm-xbold tm-mb10">Hidden Gems</div>
              <div style={{display:"grid",gap:10}}>
                {hiddenGemResults.map(g=>(
                  <div key={g._id||g.name} style={{border:"1px solid var(--tm-border)",borderRadius:12,padding:12,background:"var(--tm-surface)"}}>
                    <div style={{display:"flex",justifyContent:"space-between",gap:10}}>
                      <div>
                        <div className="tm-xbold">{g.name}</div>
                        <div style={{fontSize:".76rem",color:"var(--tm-text2)",marginTop:3}}>{g.type} · Score {Math.round(g.hiddenGemScore||0)}</div>
                      </div>
                      <div style={{padding:"4px 8px",borderRadius:999,background:"var(--tm-surface2)",color:"var(--tm-text)",fontWeight:700,fontSize:".72rem",whiteSpace:"nowrap",alignSelf:"flex-start"}}>Hidden Gem</div>
                    </div>
                    {g.desc&&<div style={{marginTop:8,color:"var(--tm-text)",lineHeight:1.45,fontSize:".83rem"}}>{g.desc}</div>}
                    {g.tip&&<div style={{marginTop:8,fontSize:".78rem",color:"var(--tm-text2)"}}><b>Why chosen:</b> {g.tip}</div>}
                    <button onClick={()=>addHiddenGemToDay(g)} style={{marginTop:10,padding:"8px 12px",borderRadius:8,border:"none",background:"#111",color:"#fff",fontWeight:700,fontFamily:"inherit"}}>Add to day</button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* FAB — floating add button */}
          <div style={{position:"fixed",bottom:82,right:18,zIndex:210}}>
            <button onClick={()=>setShowAdd(true)}
              style={{width:54,height:54,borderRadius:"50%",background:"#111",border:"none",color:"#fff",fontSize:"1.7rem",lineHeight:1,boxShadow:"0 4px 22px rgba(47,65,86,.38)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontFamily:"inherit",transition:"transform .15s, box-shadow .15s"}}
              onMouseEnter={e=>{e.currentTarget.style.transform="scale(1.1)";e.currentTarget.style.boxShadow="0 6px 28px rgba(47,65,86,.48)";}}
              onMouseLeave={e=>{e.currentTarget.style.transform="scale(1)";e.currentTarget.style.boxShadow="0 4px 22px rgba(47,65,86,.38)";}}>
              +
            </button>
          </div>


          {/* ── Route Summary ── */}
          {day.routeMeta?.segments?.length>0&&(
            <div style={{background:"var(--tm-bg)",border:"1px solid var(--tm-border)",borderRadius:14,padding:16,marginBottom:14}}>
              <div className="tm-xbold tm-mb10">Route Summary</div>
              <div className="tm-grid tm-gap8">
                {day.routeMeta.segments.map((seg,i)=>(
                  <div key={i} style={{padding:"10px 12px",borderRadius:10,background:"var(--tm-surface)",border:"1px solid var(--tm-border)"}}>
                    <div style={{fontWeight:700}}>{seg.from} → {seg.to}</div>
                    <div style={{fontSize:".78rem",color:"var(--tm-text2)",marginTop:3}}>
                      {seg.minutes!=null?`${seg.minutes} min`:"Travel time unavailable"}
                      {seg.km!=null?` · ${seg.km} km`:""}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {(day.lunch||day.dinner)&&<DiningRow lunch={day.lunch} dinner={day.dinner}/>}

          {/* ── Evening suggestion ── */}
          {day.evening&&<div style={{display:"flex",gap:12,alignItems:"flex-start",padding:"13px 14px",background:"#111",borderRadius:13,marginBottom:16,boxShadow:"0 2px 12px rgba(47,65,86,.15)"}}>
            <span style={{fontSize:"1.4rem",flexShrink:0,marginTop:1}}>🌙</span>
            <div>
              <div style={{fontSize:".62rem",fontWeight:700,textTransform:"uppercase",letterSpacing:".1em",color:"var(--tm-border)",opacity:.7,marginBottom:3}}>Evening</div>
              <div style={{fontSize:".86rem",color:"#fff",lineHeight:1.5}}>{day.evening}</div>
            </div>
          </div>}

          {/* ── Map ── */}
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
            <div className="tm-flex1" style={{height:1,background:"var(--tm-surface2)"}}/>
            <span style={{fontSize:".65rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:"var(--tm-text3)",padding:"0 4px"}}>Today's Route</span>
            <div className="tm-flex1" style={{height:1,background:"var(--tm-surface2)"}}/>
          </div>
          <DayMap acts={acts} destination={data.destination} hotel={form.hotel} isFirstDay={activeDay===0} isLastDay={activeDay===totalDays-1} userLoc={userLoc} onRequestLocation={requestLoc} visible={true} onReady={api=>planMapRef.current=api} zoomToActId={zoomActId}/>
        </div>}
        {/* Concierge tab */}
        {tab==="ai"&&<div className="fu" style={{display:"flex",flexDirection:"column",gap:12}}>
          <div style={{background:"var(--tm-bg)",border:"1px solid var(--tm-border)",borderRadius:12,padding:14}}>
            <div style={{fontWeight:800,fontSize:".9rem",marginBottom:4,color:"var(--tm-text)"}}>✨ AI Travel Concierge</div>
            <div style={{fontSize:".75rem",color:"var(--tm-text3)",marginBottom:12}}>Ask anything about your trip — swaps, food, weather, what to do next.</div>
            <div style={{display:"flex",gap:7,marginBottom:10,flexWrap:"wrap"}}>
              {["Next 2 hours","Rain backup","Dinner now","Near me now"].map(l=>(
                <button key={l} onClick={()=>runConcierge(buildQuickPrompt(l))} style={{padding:"7px 12px",borderRadius:8,border:"1px solid var(--tm-border)",background:"var(--tm-surface)",color:"var(--tm-text)",fontSize:".75rem",fontWeight:600,fontFamily:"inherit"}}>{l}</button>
              ))}
            </div>
            <div className="tm-flex tm-gap8">
              <input value={conciergeMsg} onChange={e=>setConciergeMsg(e.target.value)} onKeyDown={e=>e.key==="Enter"&&runConcierge()} placeholder="What should I do if it rains this afternoon?" style={{flex:1,padding:"10px 12px",borderRadius:10,border:"1px solid var(--tm-border)",fontFamily:"inherit",fontSize:"16px"}}/>
              <button onClick={()=>runConcierge()} disabled={conciergeLoading||!conciergeMsg.trim()} style={{padding:"10px 14px",borderRadius:10,border:"none",background:"#111",color:"#fff",fontWeight:700,fontFamily:"inherit",opacity:conciergeLoading||!conciergeMsg.trim()?.5:1}}>
                {conciergeLoading?<Spin size={16}/>:"Ask"}
              </button>
            </div>
          </div>
          {conciergeReply&&<div style={{background:"var(--tm-bg)",border:"1px solid var(--tm-border)",borderRadius:12,padding:14,display:"flex",flexDirection:"column",gap:10}}>
            <div style={{fontWeight:800,fontSize:".9rem",color:"var(--tm-text)"}}>{conciergeReply.answerTitle}</div>
            <p style={{fontSize:".82rem",color:"var(--tm-text2)",lineHeight:1.6,margin:0}}>{conciergeReply.answerText}</p>
            {conciergeReply.quickActions?.length>0&&<div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {conciergeReply.quickActions.map((qa,i)=>(
                <span key={i} style={{padding:"5px 11px",borderRadius:50,background:"var(--tm-surface2)",border:"1px solid var(--tm-border)",fontSize:".72rem",color:"var(--tm-text)",fontWeight:600}}>{qa.label}</span>
              ))}
            </div>}
            {conciergeReply.suggestions?.length>0&&<div className="tm-flex-col tm-gap8">
              <div style={{fontSize:".7rem",fontWeight:700,textTransform:"uppercase",letterSpacing:".08em",color:"var(--tm-text3)"}}>Suggestions</div>
              {conciergeReply.suggestions.map(s=>(
                <div key={s._id} style={{border:"1px solid var(--tm-border)",borderRadius:10,padding:12,background:"var(--tm-surface)"}}>
                  <div style={{fontWeight:800,fontSize:".88rem",color:"var(--tm-text)"}}>{s.name}</div>
                  {s.reason&&<div style={{fontSize:".72rem",color:"var(--tm-text2)",marginTop:2,fontStyle:"italic"}}>{s.reason}</div>}
                  {s.desc&&<div style={{fontSize:".78rem",color:"var(--tm-text)",marginTop:4,lineHeight:1.5}}>{s.desc}</div>}
                  {s.address&&<div style={{fontSize:".7rem",color:"var(--tm-text3)",marginTop:3}}>📍 {s.address}</div>}
                  <div style={{display:"flex",gap:6,marginTop:8}}>
                    <button onClick={()=>{addActivity(activeDay,s);}} style={{padding:"7px 12px",borderRadius:8,border:"none",background:"#111",color:"#fff",fontSize:".75rem",fontWeight:700,fontFamily:"inherit"}}>+ Add to day</button>
                    {s.tip&&<span style={{fontSize:".7rem",color:"var(--tm-text2)",alignSelf:"center"}}>💡 {s.tip}</span>}
                  </div>
                </div>
              ))}
            </div>}
          </div>}
        </div>}
        {/* Group tab */}
        {tab==="group"&&<GroupPlanningPanel
          groupState={groupState}
          currentDay={day}
          currentUserId={currentUserId}
          destination={data.destination}
          tripId={tripId}
          tripData={data}
          onAddMember={handleAddMember}
          onRemoveMember={handleRemoveMember}
          onAddSuggestion={handleAddSuggestion}
          onVoteSuggestion={handleVoteSuggestion}
          onClearSuggestionVote={handleClearSuggestionVote}
          onSetSuggestionStatus={handleSetSuggestionStatus}
          onDeleteSuggestion={handleDeleteSuggestion}
          onAddComment={handleAddComment}
          onMergeApproved={handleMergeApprovedSuggestions}
          onVoteActivity={handleVoteExistingActivity}
        />}


        {/* Map tab - all day maps always mounted, only active day visible */}
        <div style={{display:tab==="map"?"block":"none"}}>
          <div style={{padding:"10px 13px",background:"var(--tm-surface2)",border:"1px solid var(--tm-border)",borderRadius:9,fontSize:".8rem",color:"var(--tm-text)",marginBottom:12,fontWeight:600}}>Day {day.day||(activeDay+1)} · {acts.length} stops{form.hotel?" · Hotel start":""}</div>
          {days.map((d,i)=><DayMap key={i} acts={d.activities||[]} destination={data.destination} hotel={form.hotel} isFirstDay={i===0} isLastDay={i===totalDays-1} userLoc={userLoc} onRequestLocation={requestLoc} visible={tab==="map"&&activeDay===i}/>)}
        </div>
        {/* Tips */}
        {tab==="tips"&&<div className="fu" style={{display:"flex",flexDirection:"column",gap:11}}>
          {[{title:"General Tips",color:"var(--tm-text)",items:data.tips,b:">"},{title:"Free Things",color:"var(--tm-text2)",items:data.freebies,b:"+"},{title:"Hidden Gems",color:"var(--tm-text2)",items:data.gems,b:"*"}].map(block=>{
            if(!block.items?.length) return null;
            return<div key={block.title} style={{background:"var(--tm-bg)",border:"1px solid var(--tm-border)",borderRadius:12,padding:16}}>
              <div style={{fontWeight:700,fontSize:".88rem",marginBottom:10,color:block.color}}>{block.title}</div>
              {block.items.map((t,i)=><div key={i} style={{padding:"7px 0",borderBottom:i<block.items.length-1?"1px solid var(--tm-border)":"none",fontSize:".83rem",color:"var(--tm-text)",display:"flex",gap:9,lineHeight:1.5}}><span style={{color:block.color,flexShrink:0}}>{block.b}</span>{t}</div>)}
            </div>;
          })}
        </div>}
        </div>{/* /padding:0 14px */}
      </div>
      {/* ── Group Toast ───────────────────────────────────────────────────── */}
      {groupToast&&<div style={{position:"fixed",top:20,left:"50%",transform:"translateX(-50%)",zIndex:400,background:"#111",color:"#fff",padding:"11px 20px",borderRadius:12,fontWeight:700,fontSize:".85rem",boxShadow:"0 4px 20px rgba(0,0,0,.25)",whiteSpace:"nowrap",pointerEvents:"none",transition:"opacity .2s"}}>{groupToast}</div>}
      {/* ── Sticky save bar — hidden once trip is saved ──────────────────── */}
      {(!isSaved||savedFlash)&&<div style={{position:"fixed",bottom:72,left:0,right:0,zIndex:200,pointerEvents:"none"}}>
        <div style={{maxWidth:740,margin:"0 auto",padding:"0 16px"}}>
          <div style={{pointerEvents:"auto",background:savedFlash?"#16a34a":"#111",borderRadius:16,boxShadow:"0 4px 24px rgba(0,0,0,.18)",overflow:"hidden",transition:"background .35s"}}>
            <button onClick={handleSave} style={{width:"100%",padding:"15px 20px",border:"none",background:"transparent",color:"#fff",fontWeight:800,fontSize:"1rem",fontFamily:"inherit",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:9,letterSpacing:".01em"}}>
              {savedFlash
                ?<><span style={{fontSize:"1.1rem"}}>✓</span> {T("saved")}</>
                :<>{T("saveTrip")}</>}
            </button>
          </div>
        </div>
      </div>}
      {/* ── Budget limit sheet — at root level so position:fixed works ── */}
      {showBudgetSheet&&(()=>{
        const db=computeDayBudget(day);
        const tb=computeTripBudget(days);
        return(
          <div onClick={()=>setShowBudgetSheet(false)} className="tm-sheet-backdrop">
            <div onClick={e=>e.stopPropagation()} style={{width:"100%",maxWidth:560,background:"var(--tm-bg)",borderRadius:"20px 20px 0 0",padding:"20px 16px 36px",boxShadow:"0 -8px 40px rgba(0,0,0,.2)"}}>
              <div style={{width:36,height:4,borderRadius:99,background:"var(--tm-surface2)",margin:"0 auto 18px"}}/>
              <div style={{fontWeight:800,fontSize:"1rem",marginBottom:2,color:"var(--tm-text)"}}>💰 Budget-Limit</div>
              <div style={{fontSize:".78rem",color:"var(--tm-text3)",marginBottom:20}}>Limit setzen – bei Überschreitung kannst du den Plan mit einem Klick neu anpassen.</div>

              {/* Success feedback */}
              {budgetReplanDone&&(
                <div style={{borderRadius:12,background:"#F0FDF4",border:"1.5px solid #86EFAC",padding:"12px 14px",marginBottom:14,display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:"1.2rem"}}>✅</span>
                  <div>
                    <div style={{fontWeight:700,fontSize:".85rem",color:"#166534"}}>Plan angepasst!</div>
                    <div style={{fontSize:".73rem",color:"#166534",opacity:.8}}>{budgetReplanDone==="day"?"Tagesplan":"Gesamtplan"} wurde auf günstigere Optionen umgestellt.</div>
                  </div>
                </div>
              )}

              <div className="tm-grid tm-gap14">
                {/* Day limit */}
                <div>
                  <div style={{fontSize:".78rem",fontWeight:700,color:"var(--tm-text2)",marginBottom:6,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span>Tages-Limit · Tag {day.day}</span>
                    <span style={{color:dayBudgetLimit&&db.total>dayBudgetLimit?"#dc2626":"#888",fontWeight:600}}>
                      €{db.total.toFixed(0)}{dayBudgetLimit?" / €"+dayBudgetLimit:""}
                    </span>
                  </div>
                  <div className="tm-flex tm-gap8">
                    <input id="dbl-input" type="number" defaultValue={dayBudgetLimit||""} placeholder={T("eg80")} style={{flex:1,padding:"10px 12px",borderRadius:10,border:"1px solid var(--tm-border)",fontFamily:"inherit",fontSize:"16px"}}/>
                    <button onClick={()=>{const v=document.getElementById("dbl-input").value;saveDayBudgetLimit(v);setShowBudgetSheet(false);}} style={{padding:"10px 16px",borderRadius:10,border:"none",background:"#111",color:"#fff",fontWeight:700,fontFamily:"inherit",fontSize:".84rem",cursor:"pointer"}}>OK</button>
                  </div>
                  {dayBudgetLimit&&db.total>dayBudgetLimit&&(
                    <button onClick={replanDayToBudget}
                      style={{marginTop:10,width:"100%",padding:"11px",borderRadius:10,border:"none",background:"linear-gradient(135deg,#dc2626,#b91c1c)",color:"#fff",fontWeight:800,fontFamily:"inherit",fontSize:".88rem",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:7}}>
                      ✂️ Tag neu planen · in €{dayBudgetLimit} Rahmen
                    </button>
                  )}
                  {dayBudgetLimit&&db.total<=dayBudgetLimit&&(
                    <div style={{marginTop:6,fontSize:".72rem",color:"#16a34a",fontWeight:600}}>✓ Innerhalb des Limits</div>
                  )}
                  {dayBudgetLimit&&<button onClick={()=>{setDayBudgetLimit(null);try{localStorage.removeItem("tm_day_budget_limit");}catch(_){}}} style={{marginTop:4,fontSize:".72rem",color:"var(--tm-text3)",background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",display:"block"}}>Limit entfernen</button>}
                </div>
                <div style={{height:1,background:"var(--tm-surface2)"}}/>
                {/* Trip limit */}
                <div>
                  <div style={{fontSize:".78rem",fontWeight:700,color:"var(--tm-text2)",marginBottom:6,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span>{T("tripLimit")} · {days.length} {T("days")}</span>
                    <span style={{color:budgetLimit&&tb.total>budgetLimit?"#dc2626":"#888",fontWeight:600}}>
                      €{tb.total.toFixed(0)}{budgetLimit?" / €"+budgetLimit:""}
                    </span>
                  </div>
                  <div className="tm-flex tm-gap8">
                    <input id="tbl-input" type="number" defaultValue={budgetLimit||""} placeholder={T("eg500")} style={{flex:1,padding:"10px 12px",borderRadius:10,border:"1px solid var(--tm-border)",fontFamily:"inherit",fontSize:"16px"}}/>
                    <button onClick={()=>{const v=document.getElementById("tbl-input").value;saveBudgetLimit(v);setShowBudgetSheet(false);}} style={{padding:"10px 16px",borderRadius:10,border:"none",background:"#111",color:"#fff",fontWeight:700,fontFamily:"inherit",fontSize:".84rem",cursor:"pointer"}}>OK</button>
                  </div>
                  {budgetLimit&&tb.total>budgetLimit&&(
                    <button onClick={replanTripToBudget}
                      style={{marginTop:10,width:"100%",padding:"11px",borderRadius:10,border:"none",background:"linear-gradient(135deg,#dc2626,#b91c1c)",color:"#fff",fontWeight:800,fontFamily:"inherit",fontSize:".88rem",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:7}}>
                      ✂️ Gesamtreise neu planen · in €{budgetLimit} Rahmen
                    </button>
                  )}
                  {budgetLimit&&tb.total<=budgetLimit&&(
                    <div style={{marginTop:6,fontSize:".72rem",color:"#16a34a",fontWeight:600}}>✓ Innerhalb des Limits</div>
                  )}
                  {budgetLimit&&<button onClick={()=>{setBudgetLimit(null);try{localStorage.removeItem("tm_budget_limit");}catch(_){}}} style={{marginTop:4,fontSize:".72rem",color:"var(--tm-text3)",background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",display:"block"}}>Limit entfernen</button>}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
      {/* ── Notification manager panel — at root level ── */}
      {showNotifPanel&&(()=>{
        const schedule=buildSchedule(days);
        const upcoming=schedule.filter(s=>s.fireAt>Date.now());
        const byDay=days.map((_,di)=>upcoming.filter(s=>s.day===di+1));
        const hasPerm="Notification" in window&&Notification.permission==="granted";
        return(
          <div onClick={()=>setShowNotifPanel(false)} className="tm-sheet-backdrop">
            <div onClick={e=>e.stopPropagation()} style={{width:"100%",maxWidth:560,background:"var(--tm-bg)",borderRadius:"20px 20px 0 0",padding:"20px 16px 36px",boxShadow:"0 -8px 40px rgba(0,0,0,.2)",maxHeight:"80vh",overflowY:"auto"}}>
              <div style={{width:36,height:4,borderRadius:99,background:"var(--tm-surface2)",margin:"0 auto 18px"}}/>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
                <div style={{fontWeight:800,fontSize:"1rem",color:"var(--tm-text)"}}>{T("notifReminders")}</div>
                {notifEnabled&&<div style={{fontSize:".72rem",fontWeight:700,color:"#16a34a",background:"#F0FDF4",border:"1px solid #86EFAC",padding:"3px 10px",borderRadius:99}}>{upcoming.length} {T("notifScheduled")}</div>}
              </div>
              <div style={{fontSize:".78rem",color:"var(--tm-text3)",marginBottom:18,lineHeight:1.5}}>
                {T("notifDescSub")}
              </div>

              {/* Enable / Disable toggle */}
              {!hasPerm&&!notifEnabled&&(
                <button onClick={async()=>{await requestNotifications();}}
                  style={{width:"100%",padding:"13px",borderRadius:12,border:"none",background:"#111",color:"#fff",fontWeight:800,fontFamily:"inherit",fontSize:".95rem",cursor:"pointer",marginBottom:16,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                  {T("enableNotif")}
                </button>
              )}
              {notifEnabled&&(
                <button onClick={()=>{disableNotifications();setShowNotifPanel(false);}}
                  style={{width:"100%",padding:"11px",borderRadius:12,border:"1.5px solid var(--tm-border)",background:"var(--tm-bg)",color:"var(--tm-text2)",fontWeight:700,fontFamily:"inherit",fontSize:".85rem",cursor:"pointer",marginBottom:16}}>
                  {T("disableNotif")}
                </button>
              )}
              {hasPerm&&!notifEnabled&&(
                <button onClick={async()=>{await requestNotifications();}}
                  style={{width:"100%",padding:"13px",borderRadius:12,border:"none",background:"#111",color:"#fff",fontWeight:800,fontFamily:"inherit",fontSize:".95rem",cursor:"pointer",marginBottom:16,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                  {T("enableNotifAlt")}
                </button>
              )}

              {/* Schedule list by day */}
              {notifEnabled&&upcoming.length===0&&(
                <div style={{textAlign:"center",padding:"20px 0",color:"var(--tm-text3)",fontSize:".82rem"}}>
                  {form?.startDate?T("allPast"):T("noDateSet")}
                </div>
              )}
              {notifEnabled&&upcoming.length>0&&(
                <div className="tm-grid tm-gap12">
                  {days.map((d,di)=>{
                    const acts=byDay[di];
                    if(!acts||acts.length===0) return null;
                    return(
                      <div key={di}>
                        <div style={{fontSize:".72rem",fontWeight:800,color:"var(--tm-text2)",letterSpacing:".06em",textTransform:"uppercase",marginBottom:6}}>
                          Tag {d.day} · {d.theme||""}
                        </div>
                        <div style={{display:"grid",gap:5}}>
                          {acts.map(s=>{
                            const fireDate=new Date(s.fireAt);
                            const isToday=fireDate.toDateString()===new Date().toDateString();
                            const timeStr=fireDate.toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"});
                            const dateStr=isToday?"Heute":fireDate.toLocaleDateString("de-DE",{weekday:"short",day:"numeric",month:"short"});
                            return(
                              <div key={s.id} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",borderRadius:10,background:"var(--tm-surface)",border:"1px solid var(--tm-border)"}}>
                                <span style={{fontSize:"1.1rem",flexShrink:0}}>🔔</span>
                                <div className="tm-flex1">
                                  <div style={{fontWeight:700,fontSize:".82rem",color:"var(--tm-text)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.name}</div>
                                  <div style={{fontSize:".71rem",color:"var(--tm-text3)"}}>{dateStr} · {timeStr} Uhr (15 Min. vorher)</div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {!form?.startDate&&notifEnabled&&(
                <div style={{marginTop:14,padding:"11px 13px",borderRadius:10,background:"#FFFBEB",border:"1px solid #FDE68A",fontSize:".78rem",color:"#92400E",lineHeight:1.5}}>
                  {T("noStartDateWarn")}
                </div>
              )}
            </div>
          </div>
        );
      })()}
      {/* ── Transport sheet — at root level ── */}
      {showTransportSheet&&(()=>{
        const dest=encodeURIComponent(data.destination||"");
        const officialSite=data.transportInfo?.officialSite;
        const hasOfficial=officialSite?.startsWith("http")&&!officialSite.includes("example");
        const links=[
          ...(hasOfficial?[{label:"Offizielle ÖPNV-Seite",sub:officialSite.replace(/^https?:\/\//,"").split("/")[0],href:officialSite,icon:"🏛️"}]:[]),
          {label:"Google Maps Transit",sub:"maps.google.com",href:`https://www.google.com/maps/dir/?api=1&travelmode=transit&destination=${dest}`,icon:"🗺️"},
          {label:"Rome2rio",sub:"rome2rio.com",href:`https://www.rome2rio.com/s/${encodeURIComponent(data.destination||"")}`,icon:"✈️"},
          {label:"Citymapper",sub:"citymapper.com",href:`https://citymapper.com/directions?endname=${dest}`,icon:"🚌"},
        ];
        return(
          <div onClick={()=>setShowTransportSheet(false)} className="tm-sheet-backdrop">
            <div onClick={e=>e.stopPropagation()} style={{width:"100%",maxWidth:560,background:"var(--tm-bg)",borderRadius:"20px 20px 0 0",padding:"20px 16px 32px",boxShadow:"0 -8px 40px rgba(0,0,0,.2)"}}>
              <div style={{width:36,height:4,borderRadius:99,background:"var(--tm-surface2)",margin:"0 auto 18px"}}/>
              <div style={{fontWeight:800,fontSize:"1rem",color:"var(--tm-text)",marginBottom:4}}>🚇 Getting Around</div>
              {data.transportInfo?.description&&<p style={{fontSize:".8rem",color:"var(--tm-text2)",lineHeight:1.5,marginBottom:16}}>{data.transportInfo.description}</p>}
              <div className="tm-flex-col tm-gap8">
                {links.map((l,i)=>(
                  <a key={i} href={l.href} target="_blank" rel="noreferrer" onClick={()=>setShowTransportSheet(false)}
                    style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",borderRadius:12,border:"1.5px solid #E2EBF0",background:"#F8FAFB",textDecoration:"none",transition:"all .15s"}}>
                    <span style={{fontSize:"1.3rem",flexShrink:0}}>{l.icon}</span>
                    <div className="tm-flex1">
                      <div style={{fontSize:".85rem",fontWeight:700,color:"var(--tm-text)"}}>{l.label}</div>
                      <div style={{fontSize:".72rem",color:"var(--tm-text3)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{l.sub}</div>
                    </div>
                    <span style={{color:"var(--tm-border)",fontSize:".9rem",flexShrink:0}}>↗</span>
                  </a>
                ))}
              </div>
            </div>
          </div>
        );
      })()}
      {/* ── Move activity to day picker sheet ── */}
      {movingAct&&(()=>{
        const act=days[movingAct.fromDay]?.activities?.find(a=>(a._id||a.name)===movingAct.actId);
        if(!act) return null;
        return(
          <div onClick={()=>setMovingAct(null)} style={{position:"fixed",inset:0,zIndex:400,background:"var(--tm-overlay,rgba(0,0,0,.4))",display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
            <div onClick={e=>e.stopPropagation()} style={{width:"100%",maxWidth:560,background:"var(--tm-bg)",borderRadius:"20px 20px 0 0",padding:"20px 16px 36px",boxShadow:"0 -8px 40px rgba(0,0,0,.2)",maxHeight:"70vh",overflowY:"auto"}}>
              <div style={{width:36,height:4,borderRadius:99,background:"var(--tm-border2)",margin:"0 auto 18px"}}/>
              <div style={{fontWeight:800,fontSize:"1rem",color:"var(--tm-text)",marginBottom:4}}>{T("moveActivity")}</div>
              <div style={{fontSize:".82rem",color:"var(--tm-text3)",marginBottom:16,lineHeight:1.5}}>
                <strong style={{color:"var(--tm-text)"}}>{act.name}</strong> zu einem anderen Tag verschieben:
              </div>
              <div className="tm-grid tm-gap8">
                {days.map((d,di)=>{
                  const isCurrent=di===movingAct.fromDay;
                  const actCount=d.activities?.length||0;
                  return(
                    <button key={di}
                      disabled={isCurrent}
                      onClick={()=>{
                        moveActivityToDay(movingAct.fromDay,movingAct.actId,di);
                        setMovingAct(null);
                      }}
                      style={{
                        display:"flex",alignItems:"center",gap:12,
                        padding:"14px 16px",borderRadius:12,
                        border:isCurrent?"2px solid var(--tm-border)":"1.5px solid var(--tm-border)",
                        background:isCurrent?"var(--tm-surface2)":"var(--tm-bg)",
                        cursor:isCurrent?"default":"pointer",
                        opacity:isCurrent?.5:1,
                        fontFamily:"inherit",textAlign:"left",
                        transition:"background .15s",
                      }}>
                      <div style={{width:40,height:40,borderRadius:10,background:isCurrent?"var(--tm-border)":"#111",color:isCurrent?"var(--tm-text3)":"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:".95rem",flexShrink:0}}>
                        {d.day||di+1}
                      </div>
                      <div className="tm-flex1">
                        <div style={{fontWeight:700,fontSize:".88rem",color:"var(--tm-text)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                          {d.theme||`Tag ${d.day||di+1}`}
                          {isCurrent&&<span style={{color:"var(--tm-text3)",fontWeight:500}}> (aktuell)</span>}
                        </div>
                        <div style={{fontSize:".72rem",color:"var(--tm-text3)",marginTop:2}}>
                          {actCount} {actCount===1?T("activitiesSingular"):T("activitiesPlural")}{d.neighborhood?` · ${d.neighborhood}`:""}
                        </div>
                      </div>
                      {!isCurrent&&<span style={{color:"var(--tm-text3)",fontSize:"1.2rem",fontWeight:300}}>→</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}
      {/* ── Personality picker bottom sheet — at root level so position:fixed works ── */}
      {showPersonalityPicker&&(
        <div onClick={()=>setShowPersonalityPicker(false)} className="tm-sheet-backdrop">
          <div onClick={e=>e.stopPropagation()} style={{width:"100%",maxWidth:560,background:"var(--tm-bg)",borderRadius:"20px 20px 0 0",padding:"20px 16px 32px",boxShadow:"0 -8px 40px rgba(0,0,0,.2)"}}>
            <div style={{width:36,height:4,borderRadius:99,background:"var(--tm-surface2)",margin:"0 auto 18px"}}/>
            <div style={{fontWeight:800,fontSize:"1rem",marginBottom:4,color:"var(--tm-text)"}}>Vibe ändern</div>
            <div style={{fontSize:".78rem",color:"var(--tm-text3)",marginBottom:16}}>Wähle einen Stil — der Plan wird sofort neu generiert.</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              {Object.values(TRIP_PERSONALITIES).map(p=>{
                const isCur=p.id===personalityId;
                return(
                  <button key={p.id}
                    onClick={()=>{if(!regenLoading){handlePersonalityChange(p.id);setShowPersonalityPicker(false);}}}
                    disabled={regenLoading}
                    style={{textAlign:"left",padding:"11px 12px",borderRadius:12,border:"1.5px solid "+(isCur?"#111":"var(--tm-border)"),background:isCur?"#111":"#fff",color:isCur?"#fff":"#111",fontFamily:"inherit",cursor:regenLoading?"not-allowed":"pointer",opacity:regenLoading&&!isCur?.5:1,transition:"all .15s"}}>
                    <div style={{fontWeight:800,fontSize:".84rem",marginBottom:2}}>{p.label}{isCur?" ✓":""}</div>
                    <div style={{fontSize:".71rem",color:isCur?"rgba(255,255,255,.7)":"#555",lineHeight:1.4}}>{p.description}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Join Screen — shown when a user opens an invite link ──────────────────────
function JoinScreen({tripData,onJoin}){
  const [name,setName]=useState("");
  const dest=tripData?.destination||"this trip";
  const memberCount=(tripData?.members||[]).length;
  return(
    <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#2C365A,#111)",display:"flex",alignItems:"center",justifyContent:"center",padding:24,fontFamily:"inherit"}}>
      <style>{CSS}</style>
      <div style={{background:"var(--tm-bg)",borderRadius:24,padding:"40px 32px",maxWidth:440,width:"100%",boxShadow:"0 20px 60px rgba(0,0,0,.3)"}}>
        <div style={{textAlign:"center",marginBottom:24}}>
          <div style={{fontSize:"3rem",marginBottom:12}}>✈️</div>
          <h2 style={{fontSize:"1.5rem",fontWeight:900,color:"var(--tm-text)",margin:"0 0 8px"}}>{T("youWereInvited")}</h2>
          <p style={{color:"var(--tm-text2)",fontSize:".9rem",lineHeight:1.6,margin:0}}>
            {T("tripTo")} <b style={{color:"var(--tm-text)"}}>{dest}</b>
            {memberCount>0&&<span> · {memberCount} {memberCount===1?T("travelerSingular"):T("travelerPlural")}</span>}
          </p>
        </div>
        {/* Avatar preview of existing members */}
        {(tripData?.members||[]).length>0&&(
          <div style={{display:"flex",justifyContent:"center",gap:-4,marginBottom:24}}>
            {(tripData.members||[]).slice(0,5).map((m,i)=>(
              <div key={i} title={m.name} style={{width:36,height:36,borderRadius:"50%",background:"#111",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:".8rem",fontWeight:800,border:"2.5px solid #fff",marginLeft:i>0?-10:0,zIndex:10-i,boxShadow:"0 2px 6px rgba(0,0,0,.15)"}}>
                {(m.avatar||m.name||"?")[0].toUpperCase()}
              </div>
            ))}
          </div>
        )}
        <div style={{marginBottom:20}}>
          <label style={{display:"block",fontSize:".78rem",fontWeight:700,color:"var(--tm-text)",marginBottom:8}}>{T("yourNameGroup")}</label>
          <input
            autoFocus
            value={name}
            onChange={e=>setName(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&name.trim()&&onJoin(name.trim())}
            placeholder={T("egName")}
            style={{width:"100%",padding:"14px 16px",borderRadius:12,border:"2px solid var(--tm-border)",fontSize:"1rem",fontFamily:"inherit",outline:"none",boxSizing:"border-box"}}
          />
        </div>
        <button
          disabled={!name.trim()}
          onClick={()=>name.trim()&&onJoin(name.trim())}
          style={{width:"100%",padding:"15px",borderRadius:12,border:"none",background:name.trim()?"#111":"var(--tm-border)",color:"#fff",fontWeight:800,fontSize:"1rem",fontFamily:"inherit",cursor:name.trim()?"pointer":"default",transition:"background .15s"}}>
          Dem Trip beitreten →
        </button>
        <p style={{textAlign:"center",fontSize:".68rem",color:"var(--tm-text3)",marginTop:14,margin:"14px 0 0"}}>Kein Account nötig · Name wird nur innerhalb der Gruppe gesehen</p>
      </div>
    </div>
  );
}

// ── First-run setup screen (only shown if server has no API key yet) ───────────
function SetupKeyScreen({onDone}){
  const [key,setKey]=useState("");
  const [saving,setSaving]=useState(false);
  const [err,setErr]=useState("");
  async function save(){
    if(!key.trim().startsWith("sk-ant-")){setErr("Key must start with sk-ant-…");return;}
    setSaving(true); setErr("");
    try{
      const r=await fetch("/api/setup",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({key:key.trim()})});
      const d=await r.json();
      if(d.ok) onDone();
      else setErr(d.error||"Could not save key");
    }catch(e){setErr(e.message);}
    finally{setSaving(false);}
  }
  return(
    <div style={{minHeight:"100vh",background:"var(--tm-surface)",display:"flex",alignItems:"center",justifyContent:"center",padding:24,fontFamily:"inherit"}}>
      <style>{CSS}</style>
      <div style={{background:"var(--tm-bg)",borderRadius:20,padding:"36px 32px",maxWidth:420,width:"100%",boxShadow:"0 8px 40px rgba(47,65,86,.12)"}}>
        <div style={{fontSize:"2.4rem",marginBottom:12,textAlign:"center"}}>✈️</div>
        <h2 style={{fontSize:"1.4rem",fontWeight:900,color:"var(--tm-text)",marginBottom:6,textAlign:"center"}}>Welcome to TripMind</h2>
        <p style={{fontSize:".84rem",color:"var(--tm-text2)",textAlign:"center",lineHeight:1.6,marginBottom:24}}>
          One-time setup: enter your Claude API key to activate trip generation.<br/>
          It stays on your computer — no account needed.
        </p>
        <div style={{marginBottom:8}}>
          <div style={{fontSize:".72rem",fontWeight:700,color:"var(--tm-text)",marginBottom:5}}>🔑 Claude API Key</div>
          <input
            type="password"
            value={key}
            onChange={e=>{setKey(e.target.value);setErr("");}}
            onKeyDown={e=>e.key==="Enter"&&save()}
            placeholder="sk-ant-…"
            style={{width:"100%",padding:"12px 14px",borderRadius:10,border:`1.5px solid ${err?"#fca5a5":key?"#111":"var(--tm-border)"}`,fontSize:".9rem",fontFamily:"inherit",background:"var(--tm-surface2)",outline:"none"}}
            autoFocus
          />
          {err&&<div style={{fontSize:".73rem",color:"#dc2626",marginTop:5}}>⚠ {err}</div>}
          <div style={{fontSize:".68rem",color:"var(--tm-text3)",marginTop:6}}>
            Get a free key at <b>console.anthropic.com</b> → API Keys → Create Key.<br/>Stored locally in <code>api_key.txt</code> — never sent to third parties.
          </div>
        </div>
        <button
          onClick={save}
          disabled={saving||!key.trim()}
          style={{marginTop:16,width:"100%",padding:"13px",borderRadius:11,border:"none",background:key.trim()&&!saving?"#111":"var(--tm-border)",color:"#fff",fontWeight:800,fontSize:"1rem",fontFamily:"inherit",cursor:key.trim()&&!saving?"pointer":"default",transition:"background .15s"}}>
          {saving?"Saving…":"Save & Start →"}
        </button>
      </div>
    </div>
  );
}

// ── Root / Generation ──────────────────────────────────────────────────────────
// Long trips strategy: generate meta once, then days in small batches of 3
// Each batch is one callAI that returns multiple days at once → far fewer API calls
// ── Bottom Navigation Bar ──────────────────────────────────────────────────────
function BottomNav({tab,setTab,tripsCount}){
  const lang=getLang();
  const T=(k)=>t(lang,k);
  const profile=getUserProfile();
  const initials=getInitials(profile.name||"");
  const userPhoto=profile.photo||null;
  const active=tab===undefined?"home":tab;
  const isDark=document.documentElement.getAttribute("data-theme")==="dark";
  const iconColor=(id)=>active===id?"#fff":(isDark?"#f0f0f2":"#111");
  const HomeIcon=({c})=>(
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter">
      <polyline points="1.5,11 12,2 22.5,11"/>
      <polyline points="4,11 12,4.8 20,11"/>
      <line x1="1.5" y1="11" x2="1.5" y2="21"/>
      <line x1="22.5" y1="11" x2="22.5" y2="21"/>
      <line x1="1" y1="21" x2="23" y2="21"/>
      <rect x="9.8" y="14.5" width="4.4" height="6.6" fill={c} stroke="none"/>
    </svg>
  );
  const PlanIcon=({c})=>(
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      {/* Outer circle */}
      <circle cx="12" cy="12" r="9.5" stroke={c} strokeWidth="2"/>
      {/* Cardinal ticks */}
      <line x1="12" y1="2.5" x2="12" y2="4.8" stroke={c} strokeWidth="2" strokeLinecap="square"/>
      <line x1="12" y1="21.5" x2="12" y2="19.2" stroke={c} strokeWidth="2" strokeLinecap="square"/>
      <line x1="2.5" y1="12" x2="4.8" y2="12" stroke={c} strokeWidth="2" strokeLinecap="square"/>
      <line x1="21.5" y1="12" x2="19.2" y2="12" stroke={c} strokeWidth="2" strokeLinecap="square"/>
      {/* Diagonal ticks */}
      <line x1="18.7" y1="5.3" x2="17.4" y2="6.6" stroke={c} strokeWidth="1.5" strokeLinecap="square"/>
      <line x1="5.3" y1="5.3" x2="6.6" y2="6.6" stroke={c} strokeWidth="1.5" strokeLinecap="square"/>
      <line x1="18.7" y1="18.7" x2="17.4" y2="17.4" stroke={c} strokeWidth="1.5" strokeLinecap="square"/>
      <line x1="5.3" y1="18.7" x2="6.6" y2="17.4" stroke={c} strokeWidth="1.5" strokeLinecap="square"/>
      {/* N S W E */}
      <text x="12" y="8.6" textAnchor="middle" fontSize="3.2" fontWeight="700" fill={c} fontFamily="system-ui,sans-serif">N</text>
      <text x="12" y="18.6" textAnchor="middle" fontSize="3.2" fontWeight="700" fill={c} fontFamily="system-ui,sans-serif">S</text>
      <text x="5.8" y="13.1" textAnchor="middle" fontSize="3.2" fontWeight="700" fill={c} fontFamily="system-ui,sans-serif">W</text>
      <text x="18.2" y="13.1" textAnchor="middle" fontSize="3.2" fontWeight="700" fill={c} fontFamily="system-ui,sans-serif">E</text>
      {/* Needle (filled diamond pointing NE) */}
      <path d="M17,7 L12.7,11.8 L8.5,16.5 L11.3,12.2 Z" fill={c}/>
      {/* Center dot */}
      <circle cx="12" cy="12" r="1.2" fill={c}/>
    </svg>
  );
  return(
    <div style={{position:"fixed",bottom:0,left:0,right:0,zIndex:300,background:"var(--tm-nav-bg,rgba(255,255,255,.97))",backdropFilter:"blur(14px)",WebkitBackdropFilter:"blur(14px)",borderTop:"1px solid var(--tm-border)",padding:"8px 16px calc(8px + env(safe-area-inset-bottom))"}}>
      <div style={{maxWidth:600,margin:"0 auto",display:"flex",gap:6}}>
        {/* Home */}
        <button onClick={()=>setTab("home")}
          style={{flex:1,padding:"10px 8px 8px",borderRadius:14,border:"none",fontFamily:"inherit",cursor:"pointer",
            background:active==="home"?"#111":"transparent",
            color:active==="home"?"#fff":"var(--tm-text)",
            transition:"all .18s",position:"relative",display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
          <HomeIcon c={iconColor("home")}/>
          <span style={{fontSize:".68rem",fontWeight:active==="home"?700:500,letterSpacing:".01em"}}>Home</span>
          {tripsCount>0&&<span style={{position:"absolute",top:7,right:"calc(50% - 20px)",minWidth:17,height:17,borderRadius:999,background:"#dc2626",color:"#fff",fontSize:".58rem",fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 4px"}}>{tripsCount}</span>}
        </button>
        {/* Plan */}
        <button onClick={()=>setTab("plan")}
          style={{flex:1,padding:"10px 8px 8px",borderRadius:14,border:"none",fontFamily:"inherit",cursor:"pointer",
            background:active==="plan"?"#111":"transparent",
            color:active==="plan"?"#fff":"var(--tm-text)",
            transition:"all .18s",display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
          <PlanIcon c={iconColor("plan")}/>
        </button>
        {/* Profile */}
        <button onClick={()=>setTab("settings")}
          style={{flex:1,padding:"10px 8px 8px",borderRadius:14,border:"none",fontFamily:"inherit",cursor:"pointer",
            background:active==="settings"?"#111":"transparent",
            color:active==="settings"?"#fff":"var(--tm-text)",
            transition:"all .18s",display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
          {(()=>{
            const gc=(cx,cy,n,rt,rr,tf=0.44)=>{const s=(2*Math.PI)/n;const gap=s*(1-tf)/2;const tw=s*tf;let d='';for(let i=0;i<n;i++){const a=i*s-Math.PI/2;const f=(r,ang)=>`${(cx+r*Math.cos(ang)).toFixed(2)},${(cy+r*Math.sin(ang)).toFixed(2)}`;const pts=[f(rr,a+gap),f(rt,a+gap),f(rt,a+gap+tw),f(rr,a+gap+tw)];d+=(i===0?'M':'L')+pts[0]+' L'+pts[1]+' L'+pts[2]+' L'+pts[3]+' ';}return d+'Z';};
            const co=iconColor("settings");
            return(
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d={gc(12,12,12,10.6,8.4,0.44)} stroke={co} strokeWidth="1.3" strokeLinejoin="miter" fill="none"/>
                <circle cx="12" cy="12" r="7.6" stroke={co} strokeWidth="1.3" fill="none"/>
                <path d={gc(12,12,8,5.8,4.4,0.42)} stroke={co} strokeWidth="1.1" strokeLinejoin="miter" fill="none"/>
                <circle cx="12" cy="12" r="2.8" stroke={co} strokeWidth="1.1" fill="none"/>
                <circle cx="12" cy="12" r="1.5" stroke={co} strokeWidth="1" fill="none"/>
              </svg>
            );
          })()}
          <span style={{fontSize:".68rem",fontWeight:active==="settings"?700:500,letterSpacing:".01em"}}>{T("settings")}</span>
        </button>
      </div>
    </div>
  );
}

// ── Settings Screen ────────────────────────────────────────────────────────────
function SettingsScreen(){
  const [profile,setProfile]=useState(()=>getUserProfile());
  const [editingName,setEditingName]=useState(false);
  const [nameDraft,setNameDraft]=useState(profile.name||"");
  const [lang,setLangState]=useState(getLang);
  const [notif,setNotif]=useState(()=>{try{return localStorage.getItem("tm_notif")==="1";}catch(_){return false;}});
  const [showLangPicker,setShowLangPicker]=useState(false);
  const [langSearch,setLangSearch]=useState("");
  // Dark mode state — reads from document (set by useDarkMode in App)
  const [darkMode,setDarkMode]=useState(()=>document.documentElement.getAttribute("data-theme")==="dark");
  function toggleDark(){
    const next=!darkMode;
    setDarkMode(next);
    document.documentElement.setAttribute("data-theme",next?"dark":"light");
    try{localStorage.setItem("tm_theme",next?"dark":"light");}catch(_){}
  }
  const photoRef=useRef(null);

  function compressImage(file,maxPx=320){
    return new Promise(resolve=>{
      const img=new Image();
      const url=URL.createObjectURL(file);
      img.onload=()=>{
        URL.revokeObjectURL(url);
        const scale=Math.min(1,maxPx/Math.max(img.width,img.height));
        const c=document.createElement('canvas');
        c.width=Math.round(img.width*scale);
        c.height=Math.round(img.height*scale);
        c.getContext('2d').drawImage(img,0,0,c.width,c.height);
        resolve(c.toDataURL('image/jpeg',0.82));
      };
      img.onerror=()=>{ URL.revokeObjectURL(url); resolve(null); };
      img.src=url;
    });
  }
  async function onPhotoSelected(e){
    const file=e.target.files?.[0];
    if(!file) return;
    e.target.value='';
    const dataUrl=await compressImage(file);
    if(dataUrl) saveProfile({photo:dataUrl});
  }
  function removePhoto(){ saveProfile({photo:null}); }

  const T=(k)=>t(lang,k);

  function saveProfile(updates){
    const next={...profile,...updates};
    setProfile(next);
    try{localStorage.setItem("tm_user",JSON.stringify(next));}catch(_){}
  }
  function saveLang(code){
    setLangState(code);
    try{localStorage.setItem("tm_lang",code);}catch(_){}
    setShowLangPicker(false);
    setLangSearch("");
  }
  async function toggleNotif(){
    if(notif){
      setNotif(false);
      try{localStorage.setItem("tm_notif","0");}catch(_){}
      if("serviceWorker" in navigator){
        navigator.serviceWorker.ready.then(r=>r.active?.postMessage({type:"TM_CLEAR"})).catch(()=>{});
      }
    } else {
      if(!("Notification" in window)){alert(T("notifUnsupported"));return;}
      if("serviceWorker" in navigator){ try{await navigator.serviceWorker.register("/sw.js");}catch(_){} }
      const perm=await Notification.requestPermission();
      const on=perm==="granted";
      setNotif(on);
      try{localStorage.setItem("tm_notif",on?"1":"0");}catch(_){}
    }
  }

  const displayName=profile.name||T("defaultName");
  const currentLang=LANGUAGES[lang]||LANGUAGES.en;
  const filteredLangs=Object.entries(LANGUAGES).filter(([,l])=>l.name.toLowerCase().includes(langSearch.toLowerCase()));

  const sCard={background:"var(--tm-bg)",borderRadius:16,border:"1px solid var(--tm-border)",overflow:"hidden",marginBottom:12};
  const sSecLabel={padding:"14px 16px 8px",fontSize:".6rem",fontWeight:800,color:"var(--tm-text)",textTransform:"uppercase",letterSpacing:".13em",borderBottom:"1px solid #F2F2F2"};
  const Row=({title,sub,right,onClick,danger})=>(
    <div onClick={onClick} style={{display:"flex",alignItems:"center",gap:13,padding:"14px 16px",borderBottom:"1px solid #F2F2F2",cursor:onClick?"pointer":"default",background:"var(--tm-bg)"}}>
      <div className="tm-flex1">
        <div style={{fontSize:".9rem",fontWeight:600,color:danger?"#dc2626":"#111"}}>{title}</div>
        {sub&&<div style={{fontSize:".76rem",color:"var(--tm-text)",marginTop:2}}>{sub}</div>}
      </div>
      {right&&<div style={{flexShrink:0}}>{right}</div>}
    </div>
  );

  return(
    <div style={{minHeight:"100vh",background:"var(--tm-surface)",fontFamily:"inherit",paddingBottom:100}}>
      <style>{CSS}</style>
      <input ref={photoRef} type="file" accept="image/*" style={{display:"none"}} onChange={onPhotoSelected}/>

      {/* ── HEADER ── */}
      <div style={{background:"var(--tm-bg)",borderBottom:"1px solid var(--tm-border)",padding:"52px 20px 18px"}}>
        <div style={{maxWidth:600,margin:"0 auto"}}>
          <div style={{fontSize:".6rem",fontWeight:800,letterSpacing:".14em",textTransform:"uppercase",color:"var(--tm-text)",marginBottom:3}}>TripMind</div>
          <div style={{fontSize:"1.25rem",fontWeight:900,color:"var(--tm-text)",letterSpacing:"-.03em"}}>{T("settings")}</div>
        </div>
      </div>

      <div style={{maxWidth:600,margin:"0 auto",padding:"18px 16px"}}>

        {/* Profile avatar + name */}
        <div style={{...sCard,padding:"20px 16px",display:"flex",alignItems:"center",gap:14,marginBottom:12}}>
          <button onClick={()=>photoRef.current?.click()}
            style={{width:64,height:64,borderRadius:"50%",background:"var(--tm-surface2)",border:"1.5px solid #E0E0E0",display:"inline-flex",alignItems:"center",justifyContent:"center",color:"var(--tm-text)",fontWeight:900,fontSize:"1.4rem",cursor:"pointer",overflow:"hidden",padding:0,flexShrink:0}}>
            {profile.photo
              ?<img src={profile.photo} alt={T("profile")} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
              :<span style={{fontSize:".9rem",fontWeight:800,color:"var(--tm-text)"}}>{getInitials(profile.name)||"T"}</span>
            }
          </button>
          <div className="tm-flex1">
            {editingName?(
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <input autoFocus value={nameDraft} onChange={e=>setNameDraft(e.target.value)}
                  onKeyDown={e=>{if(e.key==="Enter"){saveProfile({name:nameDraft.trim()||T("defaultName")});setEditingName(false);}if(e.key==="Escape")setEditingName(false);}}
                  style={{flex:1,padding:"7px 10px",borderRadius:9,border:"1.5px solid #E0E0E0",fontSize:".95rem",fontWeight:700,fontFamily:"inherit",color:"var(--tm-text)",background:"var(--tm-bg)",outline:"none"}}/>
                <button onClick={()=>{saveProfile({name:nameDraft.trim()||T("defaultName")});setEditingName(false);}}
                  style={{padding:"7px 12px",borderRadius:9,border:"none",background:"#111",color:"#fff",fontWeight:700,fontFamily:"inherit",fontSize:".8rem",cursor:"pointer"}}>{T("save")}</button>
              </div>
            ):(
              <div>
                <div style={{fontSize:"1.05rem",fontWeight:800,color:"var(--tm-text)",letterSpacing:"-.02em"}}>{displayName}</div>
                <button onClick={()=>{setNameDraft(profile.name||"");setEditingName(true);}}
                  style={{background:"none",border:"none",padding:0,fontSize:".76rem",color:"var(--tm-text)",cursor:"pointer",fontFamily:"inherit",fontWeight:600,textDecoration:"underline",textUnderlineOffset:2}}>{T("editName")}</button>
              </div>
            )}
          </div>
          <button onClick={()=>photoRef.current?.click()}
            style={{padding:"7px 14px",borderRadius:10,border:"1.5px solid #E0E0E0",background:"var(--tm-bg)",color:"var(--tm-text)",fontSize:".76rem",fontWeight:700,cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>
            {profile.photo?T("changePhoto"):T("addPhoto")}
          </button>
        </div>

        {/* Notifications */}
        <div style={sCard}>
          <div style={sSecLabel}>{T("notifications")}</div>
          <Row title={T("notifTitle")} sub={T("notifSub")}
            right={
              <div onClick={toggleNotif} style={{width:46,height:26,borderRadius:99,background:notif?"#111":"var(--tm-border2)",position:"relative",cursor:"pointer",transition:"background .2s"}}>
                <div style={{position:"absolute",top:3,left:notif?22:3,width:20,height:20,borderRadius:"50%",background:"var(--tm-bg)",boxShadow:"0 1px 4px rgba(0,0,0,.2)",transition:"left .2s"}}/>
              </div>
            }/>
        </div>

        {/* Appearance */}
        <div style={sCard}>
          <div style={sSecLabel}>{T("appearance")}</div>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"13px 16px"}}>
            <div>
              <div style={{fontWeight:700,fontSize:".88rem",color:"var(--tm-text)"}}>
                {darkMode?T("darkMode"):T("lightMode")}
              </div>
              <div style={{fontSize:".74rem",color:"var(--tm-text3)",marginTop:2}}>
                {darkMode?T("darkActive"):T("lightActive")}
              </div>
            </div>
            {/* Toggle switch */}
            <button onClick={toggleDark} aria-label={T("toggleDark")}
              style={{
                width:48,height:28,borderRadius:999,border:"none",cursor:"pointer",padding:3,
                background:darkMode?"#111":"var(--tm-border)",
                transition:"background .2s",position:"relative",flexShrink:0,
              }}>
              <div style={{
                width:22,height:22,borderRadius:"50%",background:"var(--tm-bg)",
                position:"absolute",top:3,
                left:darkMode?23:3,
                transition:"left .2s",
                boxShadow:"0 1px 4px rgba(0,0,0,.25)",
              }}/>
            </button>
          </div>
        </div>

        {/* Language */}
        <div style={sCard}>
          <div style={sSecLabel}>{T("language")}</div>
          <Row title={currentLang.name} sub={T("langSub")}
            onClick={()=>setShowLangPicker(true)}
            right={<span style={{color:"var(--tm-text)",fontSize:"1.1rem",fontWeight:300}}>›</span>}/>
        </div>

        {/* Profile photo */}
        {profile.photo&&(
          <div style={sCard}>
            <div style={sSecLabel}>{T("profilePhoto")}</div>
            <Row title={T("removePhoto")} sub={T("removePhotoSub")} danger
              onClick={removePhoto}/>
          </div>
        )}

        {/* App info */}
        <div style={sCard}>
          <div style={sSecLabel}>{T("app")}</div>
          <Row title="TripMind AI" sub={T("appSub")}/>
          <Row title={T("privacy")} sub={T("privacySub")}/>
        </div>

      </div>

      {/* Language picker sheet */}
      {showLangPicker&&(
        <div onClick={()=>setShowLangPicker(false)} style={{position:"fixed",inset:0,zIndex:500,background:"rgba(0,0,0,.4)",display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
          <div onClick={e=>e.stopPropagation()} style={{width:"100%",maxWidth:560,background:"var(--tm-bg)",borderRadius:"20px 20px 0 0",padding:"20px 0 32px",maxHeight:"80vh",display:"flex",flexDirection:"column"}}>
            <div style={{width:36,height:4,borderRadius:99,background:"var(--tm-border2)",margin:"0 auto 16px"}}/>
            <div style={{fontWeight:800,fontSize:"1rem",color:"var(--tm-text)",padding:"0 20px 12px"}}>{T("selectLanguage")}</div>
            <div style={{padding:"0 16px 10px"}}>
              <input autoFocus value={langSearch} onChange={e=>setLangSearch(e.target.value)} placeholder={T("searchLang")}
                style={{width:"100%",padding:"10px 12px",borderRadius:10,border:"1.5px solid #E0E0E0",fontFamily:"inherit",fontSize:".88rem",background:"var(--tm-bg)",color:"var(--tm-text)",boxSizing:"border-box",outline:"none"}}/>
            </div>
            <div style={{overflowY:"auto",flex:1}}>
              {filteredLangs.map(([code,l])=>(
                <button key={code} onClick={()=>saveLang(code)}
                  style={{width:"100%",padding:"13px 20px",background:lang===code?"#F2F2F2":"transparent",border:"none",borderBottom:"1px solid #F2F2F2",textAlign:"left",cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:12}}>
                  <span style={{fontSize:".9rem",fontWeight:lang===code?800:500,color:"var(--tm-text)",flex:1}}>{l.name}</span>
                  {lang===code&&<span style={{color:"var(--tm-text)",fontWeight:800,fontSize:".85rem"}}>✓</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// ── Home Dashboard ──────────────────────────────────────────────────────────────
function HomeScreen({savedTrips,setSavedTrips,onLoadTrip,onNewTrip}){
  const lang=getLang();
  const T=(k)=>t(lang,k);
  const profile=getUserProfile();
  const userName=profile.name?profile.name.split(" ")[0]:"";
  const userPhoto=profile.photo||null;

  const [dest,setDest]=useState("");
  const [destFocused,setDestFocused]=useState(false);

  const sorted=[...savedTrips].sort((a,b)=>{
    const da=a._form?.startDate||"";
    const db=b._form?.startDate||"";
    return da>db?-1:da<db?1:0;
  });

  function handleQuickStart(e){
    e.preventDefault();
    if(dest.trim()) onNewTrip(dest.trim());
  }

  const TOP_DESTINATIONS=[
    {name:"Amalfi",country:"Italy",photo:"photo-1533104816931-20fa691ff6ca",emoji:"🍋"},
    {name:"Kyoto",country:"Japan",photo:"photo-1528360983277-13d401cdc186",emoji:"🌸"},
    {name:"New York",country:"USA",photo:"photo-1534430480872-3498386e7856",emoji:"🗽"},
    {name:"Santorini",country:"Greece",photo:"photo-1570077188670-e3a8d69ac5ff",emoji:"🏛️"},
    {name:"Barcelona",country:"Spain",photo:"photo-1539037116277-4db20889f2d4",emoji:"🌊"},
    {name:"Paris",country:"France",photo:"photo-1502602898657-3e91760cbb34",emoji:"🗼"},
    {name:"Bali",country:"Indonesia",photo:"photo-1537996194471-e657df975ab4",emoji:"🌴"},
    {name:"Tokyo",country:"Japan",photo:"photo-1540959733332-eab4deabeeaf",emoji:"🗾"},
  ];

  function getTripProgress(trip){
    if(!trip?._form?.startDate||!trip?._form?.endDate) return null;
    const start=new Date(trip._form.startDate+"T00:00:00");
    const end=new Date(trip._form.endDate+"T23:59:59");
    const now=new Date();
    if(now<start||now>end) return null;
    const total=end-start;
    const elapsed=now-start;
    return Math.min(100,Math.round((elapsed/total)*100));
  }

  function getTripDayLabel(trip){
    if(!trip?._form?.startDate||!trip?._form?.endDate) return null;
    const start=new Date(trip._form.startDate+"T00:00:00");
    const now=new Date();
    if(now<start) return null;
    const dayNum=Math.floor((now-start)/86400000)+1;
    const total=getDays(trip._form.startDate,trip._form.endDate);
    if(dayNum>total) return null;
    return {dayNum,total};
  }

  return(
    <div style={{minHeight:"100vh",background:"var(--tm-surface)",fontFamily:"inherit",paddingBottom:100}}>
      <style>{CSS}</style>

      {/* ── HERO SECTION ── */}
      <div style={{position:"relative",height:320,overflow:"hidden"}}>
        {/* Background photo */}
        <div style={{
          position:"absolute",inset:0,
          backgroundImage:"url(https://images.unsplash.com/photo-1501854140801-50d01698950b?w=1200&q=85)",
          backgroundSize:"cover",backgroundPosition:"center 50%",
        }}/>
        {/* Gradient overlay */}
        <div style={{position:"absolute",inset:0,background:"linear-gradient(to bottom,rgba(20,30,50,.35) 0%,rgba(20,30,50,.65) 100%)"}}/>
        {/* Bottom fade into page background */}
        <div style={{position:"absolute",bottom:0,left:0,right:0,height:80,background:"linear-gradient(to bottom,transparent,#F5EFEB)"}}/>

        {/* Top bar: avatar */}
        <div style={{position:"relative",zIndex:2,display:"flex",alignItems:"center",justifyContent:"flex-end",padding:"52px 20px 0"}}>
          {userPhoto
            ?<img src={userPhoto} alt="Profil" style={{width:36,height:36,borderRadius:"50%",objectFit:"cover",border:"2px solid rgba(255,255,255,.6)",flexShrink:0}}/>
            :<div style={{width:36,height:36,borderRadius:"50%",background:"rgba(255,255,255,.2)",backdropFilter:"blur(8px)",border:"2px solid rgba(255,255,255,.45)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:900,fontSize:".82rem",flexShrink:0}}>
              {getInitials(profile.name||"")||"T"}
            </div>
          }
        </div>

        {/* Brand wordmark */}
        <div style={{position:"relative",zIndex:2,textAlign:"center",marginTop:28}}>
          <div style={{fontSize:"2.6rem",fontWeight:900,letterSpacing:"-.04em",color:"#fff",lineHeight:1,textShadow:"0 2px 24px rgba(0,0,0,.4)"}}>TripMind</div>
          <div style={{fontSize:".85rem",color:"rgba(255,255,255,.78)",fontWeight:500,marginTop:6,letterSpacing:".02em"}}>Travel smarter. Live deeper.</div>
        </div>

        {/* Search bar — floats at hero bottom */}
        <div style={{position:"absolute",bottom:24,left:16,right:16,zIndex:3}}>
          <form onSubmit={handleQuickStart}>
            <div style={{
              background:"var(--tm-bg)",borderRadius:18,
              padding:"4px 4px 4px 18px",
              display:"flex",alignItems:"center",gap:8,
              boxShadow:"0 8px 32px rgba(0,0,0,.22)",
              border: destFocused?"1.5px solid #555":"1.5px solid transparent",
              transition:"border .18s"
            }}>
              <span style={{fontSize:"1rem",flexShrink:0}}>🔍</span>
              <input
                value={dest}
                onChange={e=>setDest(e.target.value)}
                onFocus={()=>setDestFocused(true)}
                onBlur={()=>setDestFocused(false)}
                placeholder={T("whereToGo")}
                style={{flex:1,border:"none",background:"transparent",fontSize:".95rem",fontFamily:"inherit",color:"var(--tm-text)",outline:"none",padding:"11px 0",minWidth:0}}
              />
            </div>
          </form>
        </div>
      </div>

      {/* ── INFO CARDS (two side by side) ── */}
      <div style={{margin:"22px 18px 0",display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        {/* Left card — feature bullets */}
        <div style={{background:"var(--tm-bg)",borderRadius:18,padding:"18px 16px",boxShadow:"0 2px 12px rgba(47,65,86,.09)",border:"1px solid #E8EDF2",display:"flex",flexDirection:"column",gap:0}}>
          <div style={{fontSize:".6rem",fontWeight:800,letterSpacing:".13em",textTransform:"uppercase",color:"#999",marginBottom:10}}>{T("features")}</div>
          {[T("feature1"),T("feature2"),T("feature3"),T("feature4"),T("feature5"),T("feature6")].map((item,i)=>(
            <div key={i} style={{display:"flex",alignItems:"flex-start",gap:8,paddingTop:i===0?0:9,paddingBottom:9,borderBottom:i<5?"1px solid #F2F2F0":"none"}}>
              <div style={{width:5,height:5,borderRadius:"50%",background:"#111",flexShrink:0,marginTop:5}}/>
              <div style={{fontSize:".75rem",fontWeight:600,color:"var(--tm-text)",lineHeight:1.45}}>{item}</div>
            </div>
          ))}
        </div>
        {/* Right card — description */}
        <div style={{background:"#111",borderRadius:18,padding:"18px 16px",boxShadow:"0 2px 12px rgba(0,0,0,.18)",display:"flex",flexDirection:"column",justifyContent:"space-between"}}>
          <div>
            <div style={{fontSize:".6rem",fontWeight:800,letterSpacing:".13em",textTransform:"uppercase",color:"rgba(255,255,255,.45)",marginBottom:10}}>{T("whatIsTripMind")}</div>
            <div style={{fontSize:".82rem",color:"#fff",lineHeight:1.7,fontWeight:400}}>
              {T("tripMindDesc")}
            </div>
          </div>
          <div style={{marginTop:18,fontSize:".72rem",fontWeight:700,color:"rgba(255,255,255,.55)",letterSpacing:"-.01em"}}>
            {T("personalPlanner")}
          </div>
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div style={{padding:"28px 0 0"}}>

        {/* ── TOP DESTINATIONS ── */}
        <div style={{marginBottom:28}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 18px 12px"}}>
            <div style={{fontSize:".64rem",fontWeight:800,letterSpacing:".12em",textTransform:"uppercase",color:"var(--tm-text3)"}}>{T("topDestinations")}</div>
          </div>
          {/* Horizontal scroll strip */}
          <div className="sx" style={{display:"flex",gap:12,padding:"0 18px 4px",overflowX:"auto"}}>
            {TOP_DESTINATIONS.map((d,i)=>(
              <button key={i} onClick={()=>onNewTrip(d.name)}
                style={{flexShrink:0,width:158,borderRadius:20,overflow:"hidden",border:"none",padding:0,cursor:"pointer",background:"var(--tm-bg)",
                  boxShadow:"0 4px 18px rgba(47,65,86,.13)",transition:"transform .18s, box-shadow .18s"}}
                onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-4px)";e.currentTarget.style.boxShadow="0 10px 32px rgba(47,65,86,.24)";}}
                onMouseLeave={e=>{e.currentTarget.style.transform="";e.currentTarget.style.boxShadow="0 4px 18px rgba(47,65,86,.13)";}}>
                {/* Photo */}
                <div style={{
                  height:158,
                  backgroundImage:`linear-gradient(to bottom,rgba(0,0,0,.0) 30%,rgba(0,0,0,.62) 100%),url(https://images.unsplash.com/${d.photo}?w=400&q=85)`,
                  backgroundSize:"cover",backgroundPosition:"center",
                  position:"relative",display:"flex",flexDirection:"column",justifyContent:"flex-end",padding:"12px 12px 10px"
                }}>
                  <div style={{fontSize:".88rem",fontWeight:900,color:"#fff",lineHeight:1.1,letterSpacing:"-.01em",textShadow:"0 1px 8px rgba(0,0,0,.6)"}}>{d.name}</div>
                  <div style={{fontSize:".67rem",color:"rgba(255,255,255,.82)",fontWeight:600,marginTop:3}}>{d.country}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ── MY TRIPS ── */}
        <div style={{padding:"0 18px"}}>
          <div style={{fontSize:".64rem",fontWeight:800,letterSpacing:".12em",textTransform:"uppercase",color:"var(--tm-text3)",marginBottom:12}}>
            {T("yourTrips")}
          </div>

          {/* Empty state */}
          {savedTrips.length===0&&(
            <div style={{textAlign:"center",padding:"32px 20px 28px",background:"var(--tm-bg)",borderRadius:20,border:"1px solid #E8EDF2",boxShadow:"0 2px 12px rgba(47,65,86,.07)"}}>
              <div style={{fontSize:"3.5rem",lineHeight:1,marginBottom:12}}>🗺️</div>
              <div style={{fontWeight:900,fontSize:"1.1rem",color:"var(--tm-text)",letterSpacing:"-.02em",marginBottom:6}}>{T("firstTrip")}</div>
              <div style={{fontSize:".85rem",color:"var(--tm-text3)",maxWidth:240,lineHeight:1.55,margin:"0 auto 16px"}}>{T("firstTripSub")}</div>
              <button onClick={()=>onNewTrip("")}
                style={{padding:"12px 24px",background:"#111",border:"none",borderRadius:14,color:"#fff",fontWeight:800,fontSize:".9rem",fontFamily:"inherit",cursor:"pointer",boxShadow:"0 4px 18px rgba(47,65,86,.28)"}}>
                {T("planFirstTrip")}
              </button>
            </div>
          )}

          {/* Trip cards */}
          {sorted.map((trip,idx)=>{
            const progress=getTripProgress(trip);
            const dayLabel=getTripDayLabel(trip);
            const isActive=progress!==null&&dayLabel;
            return(
              <div key={trip.id||idx} onClick={()=>onLoadTrip(trip)}
                style={{borderRadius:20,overflow:"hidden",boxShadow:"0 4px 20px rgba(47,65,86,.12)",cursor:"pointer",background:"var(--tm-bg)",border:"1px solid rgba(200,217,230,.4)",marginBottom:14,transition:"transform .18s, box-shadow .18s"}}
                onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="0 8px 32px rgba(47,65,86,.18)";}}
                onMouseLeave={e=>{e.currentTarget.style.transform="";e.currentTarget.style.boxShadow="0 4px 20px rgba(47,65,86,.12)";}}>
                {/* Photo banner */}
                <DestPhotoBg dest={trip.destination} gradient="linear-gradient(to bottom,rgba(44,54,90,.08) 0%,rgba(44,54,90,.68) 100%)" style={{height:160,position:"relative",display:"flex",flexDirection:"column",justifyContent:"flex-end",padding:"16px 18px 14px"}}>
                  {isActive&&(
                    <div style={{position:"absolute",top:12,left:14,background:"#22c55e",borderRadius:99,padding:"4px 10px",display:"flex",alignItems:"center",gap:5}}>
                      <span style={{width:5,height:5,borderRadius:"50%",background:"var(--tm-bg)",display:"inline-block"}}/>
                      <span style={{fontSize:".64rem",fontWeight:800,color:"#fff",letterSpacing:".04em"}}>AKTIV</span>
                    </div>
                  )}
                  <div style={{color:"rgba(255,255,255,.78)",fontSize:".62rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:4}}>
                    {trip._form?.startDate?fmtDate(trip._form.startDate):trip._date||""}
                    {trip._form?.endDate?" → "+fmtDate(trip._form.endDate):""}
                  </div>
                  <div style={{color:"#fff",fontWeight:900,fontSize:"1.45rem",letterSpacing:"-.03em",textShadow:"0 2px 12px rgba(0,0,0,.4)",lineHeight:1.1}}>
                    {trip.destination}
                  </div>
                  {trip.days?.length>0&&<div style={{marginTop:3,color:"rgba(255,255,255,.72)",fontSize:".74rem",fontWeight:600}}>{trip.days.length} {trip.days.length===1?"Tag":"Tage"}</div>}
                </DestPhotoBg>
                {/* Footer */}
                <div style={{padding:"11px 18px 13px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
                  <div className="tm-flex1">
                    {isActive?(
                      <div>
                        <div style={{fontSize:".7rem",color:"#22c55e",fontWeight:700,marginBottom:5}}>Tag {dayLabel.dayNum} von {dayLabel.total}</div>
                        <div style={{height:4,background:"var(--tm-surface2)",borderRadius:99,overflow:"hidden"}}>
                          <div style={{height:"100%",width:`${progress}%`,background:"linear-gradient(90deg,#111,#555)",borderRadius:99}}/>
                        </div>
                      </div>
                    ):(
                      <div style={{fontSize:".75rem",color:"var(--tm-text3)",fontWeight:500}}>
                        {trip._form?.startDate&&new Date(trip._form.startDate+"T00:00:00")>new Date()
                          ?fmtDate(trip._form.startDate)
                          :T("pastTrip")}
                      </div>
                    )}
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
                    <button onClick={e=>{e.stopPropagation();setSavedTrips(p=>p.filter(x=>x.id!==trip.id));}}
                      style={{width:28,height:28,borderRadius:"50%",background:"var(--tm-surface)",border:"1px solid var(--tm-border)",color:"var(--tm-text3)",fontSize:".8rem",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
                      ×
                    </button>
                    <button onClick={e=>{e.stopPropagation();onLoadTrip(trip);}}
                      style={{padding:"8px 16px",background:"#111",border:"none",borderRadius:11,color:"#fff",fontWeight:700,fontSize:".78rem",fontFamily:"inherit",cursor:"pointer"}}>
                      Öffnen →
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}

// ── My Trips Screen ────────────────────────────────────────────────────────────
function MyTripsScreen({savedTrips,setSavedTrips,onLoadTrip}){
  return(
    <div style={{minHeight:"100vh",background:"var(--tm-surface)",fontFamily:"inherit",paddingBottom:100}}>
      <style>{CSS}</style>
      {/* Header */}
      <div style={{background:"linear-gradient(135deg,#2C365A,#111)",padding:"32px 18px 28px",textAlign:"center"}}>
        <div style={{fontSize:".67rem",letterSpacing:".16em",textTransform:"uppercase",color:"rgba(255,255,255,.7)",fontWeight:600,marginBottom:10}}>{T("yourAdventures")}</div>
        <h1 style={{fontSize:"clamp(1.7rem,5vw,2.2rem)",fontWeight:900,letterSpacing:"-.03em",color:"#fff",marginBottom:8}}>🧳 {T("myTrips")}</h1>
        <p style={{color:"rgba(255,255,255,.75)",fontSize:".88rem"}}>{savedTrips.length} {savedTrips.length!==1?T("savedTripsPlural"):T("savedTrips")}</p>
      </div>
      <div style={{maxWidth:600,margin:"0 auto",padding:"18px 14px"}}>
        {savedTrips.length===0?(
          <div style={{textAlign:"center",padding:"60px 24px",display:"flex",flexDirection:"column",alignItems:"center",gap:14}}>
            <div style={{fontSize:"4rem"}}>🗺️</div>
            <div style={{fontWeight:900,fontSize:"1.15rem",color:"var(--tm-text)"}}>{T("noTripsSaved")}</div>
            <div style={{fontSize:".88rem",color:"var(--tm-text2)",maxWidth:260,lineHeight:1.5}}>{T("createFirstTrip")}</div>
          </div>
        ):(
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            {savedTrips.map(t=>{
              const members=t.members||[{name:"You",avatar:"👤"}];
              const totalDays=t.days?.length||"?";
              return(
                <div key={t.id} onClick={()=>onLoadTrip(t)}
                  style={{background:"var(--tm-bg)",border:"1px solid var(--tm-border)",borderRadius:18,overflow:"hidden",boxShadow:"0 3px 14px rgba(47,65,86,.10)",cursor:"pointer"}}>
                  {/* Hero image */}
                  <DestPhotoBg dest={t.destination} gradient="linear-gradient(rgba(44,54,90,.45),rgba(44,54,90,.72))" style={{height:130,position:"relative",display:"flex",alignItems:"flex-end",padding:"14px 16px"}}>
                    <div className="tm-flex1">
                      <div style={{color:"rgba(255,255,255,.75)",fontSize:".65rem",fontWeight:600,letterSpacing:".1em",textTransform:"uppercase",marginBottom:4}}>{t._date}</div>
                      <div style={{color:"#fff",fontWeight:900,fontSize:"1.18rem",textShadow:"0 2px 8px rgba(0,0,0,.4)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>✈️ {t.destination}</div>
                    </div>
                    <button onClick={e=>{
                      e.stopPropagation();
                      setSavedTrips(p=>p.filter(x=>x.id!==t.id));
                    }} style={{flexShrink:0,width:32,height:32,borderRadius:"50%",background:"rgba(0,0,0,.45)",border:"none",color:"rgba(255,255,255,.85)",fontSize:".9rem",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",marginLeft:8}}>×</button>
                  </DestPhotoBg>
                  {/* Info row */}
                  <div style={{padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <span style={{fontSize:".8rem",color:"var(--tm-text)",fontWeight:700,background:"var(--tm-surface2)",padding:"3px 10px",borderRadius:20}}>📅 {totalDays} Tage</span>
                      <div style={{display:"flex",alignItems:"center"}}>
                        {members.slice(0,4).map((m,idx)=>(
                          <div key={idx} title={m.name} style={{width:26,height:26,borderRadius:"50%",background:"#111",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:".65rem",fontWeight:800,border:"2.5px solid #fff",marginLeft:idx>0?-9:0,zIndex:4-idx,flexShrink:0}}>
                            {m.avatar||(m.name||"?")[0].toUpperCase()}
                          </div>
                        ))}
                        {members.length>4&&<span style={{fontSize:".62rem",color:"var(--tm-text3)",marginLeft:5}}>+{members.length-4}</span>}
                      </div>
                    </div>
                    <button onClick={e=>{
                      e.stopPropagation();
                      localStorage.setItem("tm_invite_"+t.id,JSON.stringify(t));
                      const url=window.location.origin+window.location.pathname+"?joinTrip="+t.id;
                      navigator.clipboard?.writeText(url).then(()=>alert(T("inviteLinkCopiedAlert"))).catch(()=>prompt(T("copyLink"),url));
                    }} style={{padding:"7px 12px",background:"#111",border:"none",borderRadius:10,fontSize:".72rem",fontWeight:700,color:"#fff",fontFamily:"inherit",cursor:"pointer",whiteSpace:"nowrap",flexShrink:0}}>
                      {T("invite")}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Trip Landing Screen ────────────────────────────────────────────────────────
function TripLandingScreen({data,form,onViewTrip,onBack}){
  const [currentTemp,setCurrentTemp]=useState(null);
  useEffect(()=>{
    async function fetchTemp(){
      try{
        const geo=await fetch("https://nominatim.openstreetmap.org/search?format=json&limit=1&q="+encodeURIComponent(data.destination)).then(r=>r.json());
        if(!geo?.[0]) return;
        const {lat,lon}=geo[0];
        const wx=await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&timezone=auto`).then(r=>r.json());
        if(wx?.current_weather?.temperature!=null) setCurrentTemp(Math.round(wx.current_weather.temperature));
      }catch(_){}
    }
    fetchTemp();
  },[data.destination]);

  // Use the global DEST_PHOTO_MAP + Wikipedia fallback for the landmark photo
  const imgUrl=useDestImg(data.destination);
  const days=data.days?.length||getDays(form?.startDate,form?.endDate)||0;
  const style=form?.style||"medium";
  const styleLabel=style==="budget"?"Budget":style==="luxury"?"Luxury":"Comfort";

  return(
    <div style={{position:"fixed",inset:0,zIndex:400,fontFamily:"inherit"}}>
      <style>{CSS}</style>

      {/* Full-screen background image */}
      <div style={{position:"absolute",inset:0,backgroundImage:`url(${imgUrl})`,backgroundSize:"cover",backgroundPosition:"center"}}/>
      {/* Dark gradient overlay — stronger at bottom */}
      <div style={{position:"absolute",inset:0,background:"linear-gradient(to bottom,rgba(0,0,0,.18) 0%,rgba(0,0,0,.08) 35%,rgba(0,0,0,.72) 70%,rgba(0,0,0,.92) 100%)"}}/>

      {/* Back button top-left */}
      <button onClick={onBack} style={{position:"absolute",top:52,left:18,zIndex:2,width:38,height:38,borderRadius:"50%",background:"rgba(255,255,255,.18)",backdropFilter:"blur(10px)",WebkitBackdropFilter:"blur(10px)",border:"1px solid rgba(255,255,255,.3)",color:"#fff",fontSize:"1rem",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontFamily:"inherit"}}>←</button>

      {/* Bottom content */}
      <div style={{position:"absolute",bottom:0,left:0,right:0,padding:"0 18px 36px"}}>

        {/* Destination name */}
        <div style={{marginBottom:16}}>
          <div style={{fontSize:"2.8rem",fontWeight:900,color:"#fff",letterSpacing:"-.04em",lineHeight:1,textShadow:"0 2px 24px rgba(0,0,0,.5)"}}>{data.destination}</div>
        </div>

        {/* Glassmorphism info card */}
        <div style={{background:"rgba(255,255,255,.14)",backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",border:"1px solid rgba(255,255,255,.22)",borderRadius:20,padding:"18px 18px 20px",marginBottom:14}}>

          {/* Top row: weather + duration + travelers */}
          <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
            {currentTemp!=null&&(
              <div style={{display:"flex",alignItems:"center",gap:6,background:"rgba(255,255,255,.18)",borderRadius:99,padding:"6px 12px"}}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.9)" strokeWidth="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                <span style={{fontSize:".75rem",fontWeight:700,color:"#fff"}}>{currentTemp}°C</span>
              </div>
            )}
            {days>0&&(
              <div style={{display:"flex",alignItems:"center",gap:6,background:"rgba(255,255,255,.18)",borderRadius:99,padding:"6px 12px"}}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.9)" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                <span style={{fontSize:".75rem",fontWeight:700,color:"#fff"}}>{days} {days===1?"Day":"Days"}</span>
              </div>
            )}
            {form?.travelers>0&&(
              <div style={{display:"flex",alignItems:"center",gap:6,background:"rgba(255,255,255,.18)",borderRadius:99,padding:"6px 12px"}}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.9)" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                <span style={{fontSize:".75rem",fontWeight:700,color:"#fff"}}>{form.travelers} {form.travelers===1?T("travelerSingular"):T("travelerPlural")}</span>
              </div>
            )}
          </div>

          {/* Divider */}
          <div style={{borderTop:"1px solid rgba(255,255,255,.18)",marginBottom:14}}/>

          {/* Description */}
          <div style={{fontSize:".84rem",color:"rgba(255,255,255,.88)",lineHeight:1.7,fontWeight:400}}>
            {data.description||data.tagline||`Discover the best of ${data.destination} — culture, food, hidden gems and unforgettable experiences await. Your personalized itinerary is ready.`}
          </div>
        </div>

        {/* View Trip button */}
        <button onClick={onViewTrip}
          style={{width:"100%",padding:"17px",borderRadius:16,border:"none",background:"var(--tm-bg)",color:"var(--tm-text)",fontSize:"1rem",fontWeight:800,cursor:"pointer",fontFamily:"inherit",letterSpacing:"-.01em",boxShadow:"0 8px 32px rgba(0,0,0,.3)",transition:"transform .15s,box-shadow .15s"}}
          onMouseEnter={e=>{e.currentTarget.style.transform="scale(1.01)";e.currentTarget.style.boxShadow="0 12px 40px rgba(0,0,0,.4)";}}
          onMouseLeave={e=>{e.currentTarget.style.transform="";e.currentTarget.style.boxShadow="0 8px 32px rgba(0,0,0,.3)";}}>
          View Trip
        </button>
      </div>
    </div>
  );
}

export default function App(){
  const lang=getLang();
  const T=(k)=>t(lang,k);
  const [dark,setDark]=useDarkMode();
  const [showLanding,setShowLanding]=useState(()=>{
    try{ const s=localStorage.getItem("tm_session"); if(s&&JSON.parse(s).email) return false; }catch(_){}
    return true;
  });
  const [screen,setScreen]=useState("setup");
  const [loadMsg,setLoadMsg]=useState("Starting…");
  const [pct,setPct]=useState(0);
  const [errorMsg,setErrorMsg]=useState("");
  const [itinerary,setItinerary]=useState(null);
  const [currentForm,setCurrentForm]=useState({});
  const [savedTrips,setSavedTrips]=useState(()=>{
    try{ const s=localStorage.getItem("tm_saved"); return s?JSON.parse(s):[]; }catch(_){ return []; }
  });
  const [needsSetup,setNeedsSetup]=useState(false);
  const [bottomTab,setBottomTab]=useState("home");
  // Badge: how many trips the user has already seen in "Meine Reisen"
  const [seenTripsCount,setSeenTripsCount]=useState(()=>{
    try{ return Number(localStorage.getItem("tm_seen_count")||0); }catch(_){ return 0; }
  });
  const unseenTrips=Math.max(0,savedTrips.length-seenTripsCount);
  const [newTripDest,setNewTripDest]=useState("");
  function switchTab(id){
    setBottomTab(id);
    if(id==="home"){
      setSeenTripsCount(savedTrips.length);
      try{ localStorage.setItem("tm_seen_count",String(savedTrips.length)); }catch(_){}
    }
  }
  // ── Join flow: replaces window.prompt ─────────────────────────────────────
  const [joinData,setJoinData]=useState(null); // {trip, joinId}
  // Auto-persist savedTrips to localStorage (debounced to prevent UI freezes on rapid edits)
  const savedTripsRef=useRef(savedTrips);
  savedTripsRef.current=savedTrips;
  useEffect(()=>{
    const timer=setTimeout(()=>{
      try{ localStorage.setItem("tm_saved",JSON.stringify(savedTripsRef.current)); }catch(_){}
    },500);
    return()=>clearTimeout(timer);
  },[savedTrips]);
  // Check if server has API key configured (only on localhost)
  useEffect(()=>{
    const isLocal=window.location.hostname==="localhost"||window.location.hostname==="127.0.0.1";
    if(!isLocal) return;
    fetch("/api/status").then(r=>r.json()).then(d=>{if(!d.configured) setNeedsSetup(true);}).catch(()=>{});
  },[]);
  // Load trip from URL on mount (?trip= share link OR ?joinTrip= invite link)
  useEffect(()=>{
    try{
      const params=new URLSearchParams(window.location.search);
      const b64=params.get("trip");
      if(b64){
        const payload=JSON.parse(decodeURIComponent(escape(atob(b64))));
        if(payload?.destination&&payload?.days){
          setItinerary(payload);
          setCurrentForm(payload._form||{});
          setScreen("trip");
          window.history.replaceState({},"",window.location.pathname);
          return;
        }
      }
      const joinId=params.get("joinTrip");
      if(joinId){
        window.history.replaceState({},"",window.location.pathname);
        let foundTrip=null;
        try{
          const raw=localStorage.getItem("tm_invite_"+joinId);
          if(raw) foundTrip=JSON.parse(raw);
        }catch(_){}
        if(!foundTrip){
          try{
            const all=JSON.parse(localStorage.getItem("tm_saved")||"[]");
            foundTrip=all.find(t=>String(t.id)===joinId)||null;
          }catch(_){}
        }
        if(foundTrip){
          // Show JoinScreen instead of window.prompt
          setJoinData({trip:foundTrip,joinId});
        } else {
          alert(T("tripNotFound"));
        }
      }
    }catch(e){ console.warn("Could not load trip from URL:",e); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);
  if(needsSetup) return <SetupKeyScreen onDone={()=>setNeedsSetup(false)}/>;
  if(showLanding) return <LandingScreen onEnter={()=>setShowLanding(false)}/>;
  // ── Join screen — shown when user opens invite link ────────────────────────
  if(joinData) return <JoinScreen tripData={joinData.trip} onJoin={(name)=>{
    const newMember={id:uid(),name:name.trim(),avatar:name.trim()[0].toUpperCase()};
    const updatedTrip={...joinData.trip,members:[...(joinData.trip.members||[{id:"u1",name:"Organiser",avatar:"O"}]),newMember]};
    const tId=updatedTrip.id||joinData.joinId;
    // Persist new member identity under this tripId so Trip can read it
    try{localStorage.setItem("tm_user_"+tId,JSON.stringify(newMember));}catch(_){}
    // Also update groupState so the new member appears in the Group panel
    try{
      const gsKey="tm_gs_"+tId;
      const raw=localStorage.getItem(gsKey);
      const gs=raw?JSON.parse(raw):null;
      if(gs?.members){
        if(!gs.members.some(m=>m.id===newMember.id)){
          gs.members.push({id:newMember.id,name:newMember.name,role:"member"});
          localStorage.setItem(gsKey,JSON.stringify(gs));
        }
      }
    }catch(_){}
    setItinerary(updatedTrip);
    setCurrentForm(updatedTrip._form||{});
    setJoinData(null);
    setScreen("trip");
  }}/>;


// ── Real weather via Open-Meteo (free, no key) ────────────────────────────────
async function fetchRealWeather(destination, startDate, totalDays){
  try{
    // Geocode destination to lat/lon
    const geo=await fetch("https://nominatim.openstreetmap.org/search?format=json&limit=1&q="+encodeURIComponent(destination)).then(r=>r.json());
    if(!geo||!geo[0]) return null;
    const {lat,lon}=geo[0];
    // Open-Meteo forecast (up to 16 days ahead)
    const url=`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto&forecast_days=${Math.min(totalDays,14)}&start_date=${startDate}`;
    const wx=await fetch(url).then(r=>r.json());
    if(!wx?.daily?.time) return null;
    // WMO weather codes → description
    function wmoDesc(code){
      if(code<=1) return "Clear";
      if(code<=3) return "Partly cloudy";
      if(code<=49) return "Fog";
      if(code<=59) return "Drizzle";
      if(code<=69) return "Rain";
      if(code<=79) return "Snow";
      if(code<=82) return "Rain showers";
      if(code<=84) return "Snow showers";
      if(code<=99) return "Thunderstorm";
      return "Mixed";
    }
    return wx.daily.time.map((date,i)=>({
      date,
      desc:wmoDesc(wx.daily.weathercode[i]),
      max:Math.round(wx.daily.temperature_2m_max[i]),
      min:Math.round(wx.daily.temperature_2m_min[i]),
      rain:(wx.daily.precipitation_sum[i]||0)>3
    }));
  }catch(e){ console.warn("Weather fetch failed:",e); return null; }
}

  async function generate(form){
    setCurrentForm(form); setErrorMsg(""); setScreen("loading"); setPct(0);
    const totalDays=Math.min(getDays(form.startDate,form.endDate)||3,21);
    const dest=form.destination;
    const hotel=form.hotel||"";
    const interests=form.interests?.length?form.interests.join(", "):"general sightseeing";
    const style=form.style||"medium";
    const transport=form.transport||"mixed";
    const profile=`${form.travelers} pax, ${form.ageGroup}, ${style} budget, ${transport} transport`;
    const hotelLine=hotel?`Hotel: ${hotel}. Only suggest places within 30 min of hotel.`:"";

    function tcFor(dn){
      const isFirst=dn===1, isLast=dn===totalDays;
      const parts=[];
      if(isFirst&&form.arrivalTime){
        const am=toMins(form.arrivalTime);
        if(am!=null){
          if(am>=1200) parts.push(`Very late arrival (${form.arrivalTime}). Only 1 activity: dinner nearby.`);
          else parts.push(`Arrival ${form.arrivalTime}. Start activities at ${fmtTime(am+60)} earliest.`);
        }
      }
      if(isLast&&form.departureTime){
        const dm=toMins(form.departureTime);
        if(dm!=null) parts.push(`Departure ${form.departureTime}. Last activity ends by ${fmtTime(dm-120)}.`);
      }
      return parts.join(" ");
    }

    function numActsFor(dn){
      const tc=tcFor(dn);
      if(tc.includes("Only 1 activity")) return 1;
      if(tc.includes("Start activities at")){
        const am=toMins(form.arrivalTime)||0;
        const h=(22*60-am-60)/60;
        return h<4?1:h<7?2:3;
      }
      if(tc.includes("Last activity ends by")){
        const dm=toMins(form.departureTime)||0;
        const h=((dm-120)-9*60)/60;
        return h<3?1:h<5?2:3;
      }
      return 3;
    }

    const appLang=getLang();
    const langName=LANGUAGES[appLang]?.name||"English";
    const langInstruction=appLang==="en"?"":` IMPORTANT: Write ALL text values (theme, descriptions, tips, evening, cuisine, etc.) in ${langName}.`;

    function buildDayPrompt(dn){
      const tc=tcFor(dn);
      const n=numActsFor(dn);
      const storedPersonality=(()=>{try{return localStorage.getItem("tm_personality")||"";}catch(_){return "";}})();
      const personalityBlock=buildPersonalityPromptBlock(storedPersonality||getDefaultPersonalityFromForm(form));
      return "You are a travel expert. Respond ONLY with a single JSON object, no markdown, no comments."+langInstruction+"\n"
        +`Plan day ${dn} of ${totalDays} in ${dest}. ${profile}. Interests: ${interests}. ${hotelLine} ${tc}\n`
        +`${personalityBlock}\n`
        +"Only include activities open at scheduled time (museums 09-18, bars 20+, restaurants lunch 12-15 dinner 19-23).\n"
        +`Include exactly ${n} activities. Make each day feel distinct from the others.\n`
        +"Return exactly:\n"
        +'{"day":'+dn+',"theme":"short 3-word location or activity theme (e.g. Old Town Walk, Harbour & Markets, Museum District)","neighborhood":"area name",'
        +'"weatherForecast":"Sunny 22C","timeWindow":"09:00-22:00",'
        +'"budget":{"budget":"50 EUR","medium":"100 EUR","luxury":"200 EUR"},'
        +'"evening":"one sentence evening suggestion",'
        +'"lunch":{"name":"place name","cuisine":"type","price":"15 EUR","desc":"short","imgQuery":"food keyword"},'
        +'"dinner":{"name":"place name","cuisine":"type","price":"25 EUR","desc":"short","imgQuery":"food keyword"},'
        +'"activities":['
        +'{"time":"09:00","name":"place name","type":"Museum","desc":"very short desc",'
        +'"address":"street, city","duration":"2h","price":"12 EUR","isFree":false,"isHidden":false,'
        +'"openHours":"09:00-18:00","tip":"short insider tip","transport":"Metro line X","imgQuery":"3 words"}'
        +']}';
    }

    try{
      // ── Step 1: meta + all days fire in parallel ──────────────────────────
      setLoadMsg(`Planning all ${totalDays} days in parallel…`); setPct(5);

      const metaP="You are a travel expert. Respond ONLY with a single JSON object, no markdown, no comments."+langInstruction+"\n"
        +`Trip: ${dest}, ${totalDays} days, ${profile}.\n`
        +"Return exactly these keys:\n"
        +'{"destination":"","tagline":"","description":"2-3 sentence vivid description of the destination — culture, atmosphere, what makes it special","currency":"","language":"","emergency":"","weatherNote":"",'
        +'"transportInfo":{"description":"","officialSite":"","ticketSite":""},'
        +'"tips":["","",""],"freebies":["","",""],"gems":["",""],"packing":["","","",""]}';

      // Track per-day completion for live progress
      let doneDays=0;
      function onDayDone(){ doneDays++; setPct(10+Math.round((doneDays/totalDays)*85)); setLoadMsg(`Days ready: ${doneDays} / ${totalDays}…`); }

      // Fire everything at once
      const metaPromise=callAI(metaP,600);
      const dayPromises=[];
      for(let dn=1;dn<=totalDays;dn++){
        const p=dn; // capture
        dayPromises.push(
          callAI(buildDayPrompt(p),950)
            .then(dayData=>{
              onDayDone();
              const acts=(dayData.activities||[]).map(a=>({_id:uid(),...a}));
              return{...dayData,day:p,activities:acts};
            })
            .catch(err=>{
              // On per-day failure, return a minimal placeholder so Promise.all doesn't abort
              onDayDone();
              console.warn(`Day ${p} failed:`,err.message);
              return{day:p,theme:"Day "+p,activities:[],_failed:true};
            })
        );
      }

      // Await both together
      const [meta,...dayResults]=await Promise.all([metaPromise,...dayPromises]);
      if(!meta||!meta.destination) throw new Error("Could not load destination info – please try again");

      // Sort (parallel resolves in any order) and strip failed placeholders warning
      const allDays=dayResults.sort((a,b)=>a.day-b.day);
      const failedCount=allDays.filter(d=>d._failed).length;
      if(failedCount===allDays.length) throw new Error("All days failed to generate – please try again");

      setPct(96);
      // ── Patch with real weather if start date is within 14 days ──────────
      if(form.startDate){
        const today=new Date(); today.setHours(0,0,0,0);
        const start=new Date(form.startDate+"T00:00:00");
        const daysAhead=Math.round((start-today)/86400000);
        if(daysAhead>=0&&daysAhead<=14){
          setLoadMsg("Fetching real weather…");
          const wxData=await fetchRealWeather(dest,form.startDate,totalDays);
          if(wxData){
            allDays.forEach((d,i)=>{
              const wx=wxData[i];
              if(!wx) return;
              const label=`${wx.desc} ${wx.max}C`;
              d.weatherForecast=label;
              d._realWeather=wx; // keep raw for rain-proof trigger
            });
          }
        }
      }
      setPct(99);
      setItinerary({...meta,days:allDays});
      setScreen("trip-landing");
    }catch(err){
      console.error("Generation error:",err);
      setErrorMsg(err.message||"Unknown error – please try again");
      setScreen("error");
    }
  }

  function saveTrip({days:currentDays,groupState:currentGroupState}={}){
    if(!itinerary) return;
    const tripId=itinerary.id||("trip_"+Date.now());
    // Include live days from Trip so edits are never lost
    const saved={...itinerary,id:tripId,_date:new Date().toLocaleDateString(),_form:currentForm,...(currentDays?{days:currentDays}:{}),...(currentGroupState?{_groupState:currentGroupState}:{})};
    setItinerary(saved);
    setSavedTrips(p=>[saved,...p.filter(t=>t.id!==tripId)]);
  }

  function shareTrip({days:currentDays,groupState:currentGroupState}={}){
    if(!itinerary) return;
    try{
      const payload=JSON.stringify({...itinerary,...(currentDays?{days:currentDays}:{}),...(currentGroupState?{_groupState:currentGroupState}:{}),_form:currentForm});
      const b64=btoa(unescape(encodeURIComponent(payload)));
      const url=window.location.origin+window.location.pathname+"?trip="+b64;
      if(navigator.share){
        navigator.share({title:"My trip to "+itinerary.destination,url}).catch(()=>{});
      } else {
        navigator.clipboard.writeText(url).then(()=>alert(T("shareLinkCopied"))).catch(()=>{
          prompt("Copy this link:",url);
        });
      }
    }catch(e){ alert("Could not create share link: "+e.message); }
  }

  if(screen==="loading") return <Loading msg={loadMsg} pct={pct}/>;
  if(screen==="trip-landing"&&itinerary) return <TripLandingScreen data={itinerary} form={currentForm} onViewTrip={()=>setScreen("trip")} onBack={()=>{setScreen("setup");setBottomTab("plan");}}/>;
  if(screen==="trip"&&itinerary) return <Trip data={itinerary} form={currentForm} onBack={()=>{setScreen("setup");setBottomTab("trips");}} onSave={saveTrip} onShare={shareTrip} savedTrips={savedTrips}/>;
  if(screen==="error") return(
    <div style={{minHeight:"100vh",background:"var(--tm-bg)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:"inherit",padding:24,gap:18,textAlign:"center"}}>
      <style>{CSS}</style>
      <div style={{fontSize:"3rem"}}>⚠️</div>
      <div style={{fontSize:"1.15rem",fontWeight:900,color:"#dc2626"}}>{T("generationFailed")}</div>
      <div style={{fontSize:".88rem",color:"var(--tm-text2)",maxWidth:360,background:"#fef2f2",border:"1px solid var(--tm-border)",borderRadius:10,padding:"14px 16px",lineHeight:1.6,wordBreak:"break-word"}}>{errorMsg}</div>
      <div style={{fontSize:".78rem",color:"var(--tm-text3)",maxWidth:320}}>{T("checkConnection")}</div>
      <Btn onClick={()=>setScreen("setup")} color="#111">{T("tryAgain")}</Btn>
    </div>
  );
  const handleLoadTrip=(t)=>{setItinerary(t);setCurrentForm(t._form||{});setScreen("trip-landing");};
  function handleNewTrip(dest){
    if(dest) setNewTripDest(dest);
    switchTab("plan");
  }
  return(
    <div style={{paddingBottom:72}}>
      {bottomTab==="home"&&<HomeScreen savedTrips={savedTrips} setSavedTrips={setSavedTrips} onLoadTrip={handleLoadTrip} onNewTrip={handleNewTrip}/>}
      {bottomTab==="plan"&&<Setup onGenerate={generate} initialDest={newTripDest} savedTrips={savedTrips} setSavedTrips={setSavedTrips} onLoadTrip={handleLoadTrip}/>}
      {bottomTab==="settings"&&<SettingsScreen/>}
      <BottomNav tab={bottomTab} setTab={switchTab} tripsCount={unseenTrips}/>
    </div>
  );
}

