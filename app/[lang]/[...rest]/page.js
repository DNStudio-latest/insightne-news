// Any address that matches no page ends up here, so the "Page not found" page is drawn inside the site layout.
import { notFound } from "next/navigation";

export default function NotFoundCatchAll() {
  notFound();
}
