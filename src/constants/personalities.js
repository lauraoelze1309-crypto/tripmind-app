// TripMind trip personality definitions
export const TRIP_PERSONALITIES = {
  explorer:  {id:"explorer",  label:"🗺️ Explorer",         description:"Packed days, lots of variety, mix of must-sees and hidden corners.",     pace:"fast",   diningStyle:"local",      activityBias:["sightseeing","walking","culture","landmark"]},
  relaxed:   {id:"relaxed",   label:"☀️ Relaxed",           description:"Slow mornings, fewer activities, time to breathe and soak it in.",       pace:"slow",   diningStyle:"sit-down",   activityBias:["park","cafe","garden","scenic","viewpoint"]},
  foodie:    {id:"foodie",    label:"🍽️ Foodie",            description:"Built around meals, markets, and culinary experiences.",                  pace:"medium", diningStyle:"restaurant", activityBias:["food","market","dining","restaurant","tasting"]},
  cultural:  {id:"cultural",  label:"🎭 Cultural Deep-Dive",description:"Museums, history, arts, and local traditions take center stage.",         pace:"medium", diningStyle:"local",      activityBias:["museum","history","art","gallery","heritage"]},
  adventure: {id:"adventure", label:"⚡ Adventure",          description:"Active, outdoorsy, physically engaging — no lazy mornings.",              pace:"fast",   diningStyle:"quick",      activityBias:["outdoor","sport","hike","nature","activity"]},
  luxury:    {id:"luxury",    label:"✨ Luxury",             description:"Premium experiences, fine dining, spas, and high-end stays.",             pace:"medium", diningStyle:"fine-dining",activityBias:["luxury","spa","premium","rooftop","exclusive"]},
  budget:    {id:"budget",    label:"💸 Budget Traveller",  description:"Free attractions, street food, local transport, maximum value.",          pace:"fast",   diningStyle:"street",     activityBias:["free","walking","market","street","gratis"]},
  romantic:  {id:"romantic",  label:"💑 Romantic",          description:"Intimate settings, scenic spots, candlelit dinners, and memorable moments.",pace:"slow",  diningStyle:"fine-dining",activityBias:["scenic","sunset","panoramic","garden","view"]},
};
