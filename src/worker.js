// Worker entry point. For now this just hands every request to the static
// Assets binding (see wrangler.jsonc). Later phases add a check here that
// routes WebSocket upgrade requests for online rooms to a Durable Object
// instead, before falling through to assets for everything else.
export default {
  async fetch(request, env) {
    return env.ASSETS.fetch(request);
  },
};
