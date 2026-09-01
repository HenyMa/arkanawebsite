import { ButtonLink } from "@/components/Button";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md px-5 py-40 text-center sm:px-10">
      <h1 className="display-line text-graphite">404</h1>
      <p className="mt-8 text-sm text-slate">
        This page isn&apos;t part of the collection.
      </p>
      <div className="mt-11">
        <ButtonLink href="/shop" variant="link">
          Shop the collection
        </ButtonLink>
      </div>
    </div>
  );
}
