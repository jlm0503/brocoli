import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TabsContent } from "@/components/ui/tabs";
import { useCampo, type CatalogoSimple } from "@/lib/campo/store";

type Campo = { key: "contacto" | "telefono" | "correo" | "placas"; label: string; type?: string };

/** Pestañas de catálogos sencillos: cultivos y variedades, viveros, choferes, problemas de calidad y congeladora. */
export function CatalogosExtra() {
  const { viveros, choferes, problemas } = useCampo();
  return (
    <>
      <TabsContent value="cultivos">
        <CultivosYVariedades />
      </TabsContent>
      <TabsContent value="viveros">
        <ListaSimple
          col="viveros"
          items={viveros}
          vacio="Aún no hay viveros. Se eligen al planear un lote."
          campos={[
            { key: "contacto", label: "Contacto" },
            { key: "telefono", label: "Teléfono", type: "tel" },
            { key: "correo", label: "Correo", type: "email" },
          ]}
        />
      </TabsContent>
      <TabsContent value="choferes">
        <ListaSimple
          col="choferes"
          items={choferes}
          vacio="Aún no hay choferes. Se usarán al capturar la salida de cada viaje (fase de cosecha)."
          campos={[
            { key: "telefono", label: "Teléfono", type: "tel" },
            { key: "placas", label: "Placas" },
          ]}
        />
      </TabsContent>
      <TabsContent value="problemas">
        <ListaSimple col="problemas" items={problemas} vacio="Sin problemas de calidad." campos={[]} />
      </TabsContent>
      <TabsContent value="congeladora">
        <CongeladoraUnica />
      </TabsContent>
    </>
  );
}

function ListaSimple({
  col,
  items,
  campos,
  vacio,
}: {
  col: CatalogoSimple;
  items: ({ id: string; nombre: string } & Partial<Record<Campo["key"], string>>)[];
  campos: Campo[];
  vacio: string;
}) {
  const { agregarSimple, eliminarSimple } = useCampo();
  const [nuevo, setNuevo] = useState<Record<string, string>>({});

  const agregar = () => {
    const extra = Object.fromEntries(campos.map((c) => [c.key, nuevo[c.key] ?? ""]));
    const err = agregarSimple(col, { nombre: nuevo["nombre"] ?? "", ...extra });
    if (err) return void toast.error(err);
    toast.success(`${(nuevo["nombre"] ?? "").trim()} agregado`);
    setNuevo({});
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 rounded-xl border border-border bg-card p-4 shadow-card sm:grid-cols-[repeat(auto-fit,minmax(10rem,1fr))_auto] sm:items-end">
        <div className="space-y-1.5">
          <Label htmlFor={`${col}-nombre`}>Nombre</Label>
          <Input
            id={`${col}-nombre`}
            value={nuevo["nombre"] ?? ""}
            onChange={(e) => setNuevo((n) => ({ ...n, nombre: e.target.value }))}
            onKeyDown={(e) => e.key === "Enter" && agregar()}
          />
        </div>
        {campos.map((c) => (
          <div key={c.key} className="space-y-1.5">
            <Label htmlFor={`${col}-${c.key}`}>{c.label}</Label>
            <Input
              id={`${col}-${c.key}`}
              type={c.type ?? "text"}
              value={nuevo[c.key] ?? ""}
              onChange={(e) => setNuevo((n) => ({ ...n, [c.key]: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && agregar()}
            />
          </div>
        ))}
        <Button onClick={agregar}>
          <Plus /> Agregar
        </Button>
      </div>

      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-card/60 p-5 text-sm text-muted-foreground">{vacio}</p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card shadow-card">
          {items.map((x) => (
            <li key={x.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
              <div>
                <span className="font-medium">{x.nombre}</span>
                {campos.length > 0 && (
                  <span className="ml-3 text-muted-foreground">
                    {campos
                      .map((c) => x[c.key])
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                )}
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="size-8"
                aria-label={`Eliminar ${x.nombre}`}
                onClick={() => {
                  const err = eliminarSimple(col, x.id);
                  if (err) toast.error(err);
                  else toast(`${x.nombre} eliminado`);
                }}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CultivosYVariedades() {
  const { cultivos, variedades, agregarVariedad, eliminarVariedad } = useCampo();
  const [cultivoElegido, setCultivo] = useState("");
  const cultivo = cultivos.some((c) => c.id === cultivoElegido) ? cultivoElegido : (cultivos[0]?.id ?? "");
  const [nombre, setNombre] = useState("");
  const [dias, setDias] = useState("");

  const agregar = () => {
    const err = agregarVariedad({ nombre, cultivo, cicloDias: Number(dias) });
    if (err) return void toast.error(err);
    toast.success(`Variedad ${nombre.trim()} agregada`);
    setNombre("");
    setDias("");
  };

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <section>
        <h3 className="mb-3 text-xl font-semibold">Cultivos</h3>
        <ListaSimple col="cultivos" items={cultivos} campos={[]} vacio="Sin cultivos." />
      </section>
      <section>
        <h3 className="mb-3 text-xl font-semibold">Variedades</h3>
        <div className="mb-4 grid gap-3 rounded-xl border border-border bg-card p-4 shadow-card sm:grid-cols-[1fr_1fr_7rem_auto] sm:items-end">
          <div className="space-y-1.5">
            <Label>Cultivo</Label>
            <Select value={cultivo} onValueChange={setCultivo}>
              <SelectTrigger aria-label="Cultivo de la variedad">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {cultivos.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="var-nombre">Variedad</Label>
            <Input id="var-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="var-dias">Días a cosecha</Label>
            <Input
              id="var-dias"
              type="number"
              inputMode="numeric"
              min="1"
              value={dias}
              onChange={(e) => setDias(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && agregar()}
              className="num"
            />
          </div>
          <Button onClick={agregar}>
            <Plus /> Agregar
          </Button>
        </div>
        <ul className="divide-y divide-border rounded-xl border border-border bg-card shadow-card">
          {cultivos.map((c) => {
            const vs = variedades.filter((v) => v.cultivo === c.id);
            if (vs.length === 0) return null;
            return vs.map((v) => (
              <li key={v.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <span>
                  <span className="font-medium">{v.nombre}</span>
                  <span className="ml-2 text-muted-foreground">
                    {c.nombre} · <span className="num">{v.cicloDias}</span> días (cosecha en semana{" "}
                    {Math.ceil(v.cicloDias / 7)})
                  </span>
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8"
                  aria-label={`Eliminar ${v.nombre}`}
                  onClick={() => {
                    const err = eliminarVariedad(v.id);
                    if (err) toast.error(err);
                    else toast(`${v.nombre} eliminada`);
                  }}
                >
                  <Trash2 />
                </Button>
              </li>
            ));
          })}
        </ul>
      </section>
    </div>
  );
}

/** Por ahora hay una sola congeladora: se muestra su nombre y no hay selector. */
function CongeladoraUnica() {
  const { congeladoras, renombrarSimple } = useCampo();
  const c = congeladoras[0];
  const [nombre, setNombre] = useState("");
  if (!c) return <p className="text-sm text-muted-foreground">Sin congeladora registrada.</p>;
  const guardar = () => {
    const err = renombrarSimple("congeladoras", c.id, nombre);
    if (err) return void toast.error(err);
    toast.success("Nombre guardado");
    setNombre("");
  };
  return (
    <div className="max-w-lg rounded-xl border border-border bg-card p-5 shadow-card">
      <p className="eyebrow">Congeladora a la que se entrega</p>
      <p className="mt-1 text-2xl font-semibold">{c.nombre}</p>
      <div className="mt-4 flex items-end gap-2">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="cong-nombre">Cambiar nombre</Label>
          <Input
            id="cong-nombre"
            value={nombre}
            placeholder={c.nombre}
            onChange={(e) => setNombre(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && guardar()}
          />
        </div>
        <Button onClick={guardar} disabled={!nombre.trim()}>
          Guardar
        </Button>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Por ahora solo hay una, así que no se pide elegirla en ninguna pantalla.
      </p>
    </div>
  );
}
