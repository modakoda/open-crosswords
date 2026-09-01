import { GenerateForm } from "@/components/GenerateForm";

export default function HomePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Generate a crossword</h1>
        <p className="mt-1 text-muted-foreground">
          Pick a language and (optionally) some topics. Every puzzle is built
          from a fresh, topic-spread selection of clues, sized to print on your
          chosen paper — or solve it online and share the link.
        </p>
      </div>
      <GenerateForm />
    </div>
  );
}
