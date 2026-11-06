// A small History API router. Links the API hands out (`/projects/<id>`, `/invitations/<id>`) are
// routes of this app: the server answers them with index.html, and an unsigned visitor is asked to
// sign in first and then sent on.

let renderer = () => {};
export const setRenderer = (fn) => {
  renderer = fn;
};

/** Moves to `path`. `replace` swaps the history entry instead of adding one. */
export function go(path, replace = false) {
  if (replace) history.replaceState(null, '', path);
  else history.pushState(null, '', path);
  renderer();
  return null;
}
