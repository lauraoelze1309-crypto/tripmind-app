// TripMind local transit sites
export const TRANSIT_SITES={
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
export function getLocalTransitUrl(destination){
  if(!destination) return null;
  const d=destination.toLowerCase();
  for(const [city,url] of Object.entries(TRANSIT_SITES)){
    if(d.includes(city)) return url;
  }
  return null;
}
