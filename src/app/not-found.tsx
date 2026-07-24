import { ButtonLink } from "@/components/Button";
import { Mark } from "@/components/Logo";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md px-5 py-32 text-center sm:px-8">
      <Mark className="mx-auto h-10 w-10 text-tan" />
      <h1 className="mt-8 font-display text-5xl font-light text-graphite">404</h1>
      <p className="mt-4 text-sm text-slate">
        This page isn&apos;t part of the collection.
      </p>
      <ButtonLink href="/hoodies" className="mt-9">
        Shop hoodies
      </ButtonLink>
    </div>
  );
}
