import { ButtonLink } from "./Button";

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
    <div className="mx-auto max-w-md px-5 py-36 text-center sm:px-10">
      <h1 className="section-title text-graphite">{title}</h1>
      <p className="mt-7 text-sm leading-relaxed text-slate">{body}</p>
      <div className="mt-11">
        <ButtonLink href="/shop" variant="link">
          Back to the collection
        </ButtonLink>
      </div>
    </div>
  );
}
