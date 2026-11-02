// Phone alerts go to the browser makers' own push services. Only their addresses are accepted: otherwise anyone could
// sign up an address of their choice and make our server send a message to it every time an alert goes out.
const SERVICES = [
  /^fcm\.googleapis\.com$/, // Chrome, Edge, Brave, Opera, Samsung Internet
  /^([a-z0-9-]+\.)*push\.services\.mozilla\.com$/, // Firefox
  /^([a-z0-9-]+\.)*notify\.windows\.com$/, // Edge (Windows)
  /^([a-z0-9-]+\.)*push\.apple\.com$/, // Safari
];

export function isPushServiceUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && (url.port === "" || url.port === "443") && SERVICES.some((re) => re.test(url.hostname));
  } catch {
    return false;
  }
}
