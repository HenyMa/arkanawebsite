import { ButtonLink } from "./Button";
import { Mark } from "./Logo";

/**
 * Shown where a feature needs environment keys that haven't been added yet.
 * Keeps the site presentable while it's being set up, rather than 500-ing.
 */
export function NotConfigured({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="mx-auto max-w-md px-5 py-28 text-center sm:px-8">
      <Mark className="mx-auto h-10 w-10 text-tan" />
      <h1 className="mt-7 font-display text-3xl font-light text-graphite">
        {title}
      </h1>
      <p className="mt-4 text-sm leading-relaxed text-slate">{body}</p>
      <ButtonLink href="/shop" variant="outline" className="mt-9">
        Back to the collection
      </ButtonLink>
    </div>
  );
}
