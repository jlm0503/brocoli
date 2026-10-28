import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80",
        outline: "text-foreground",
        libre: "border-transparent bg-status-libre text-status-libre-foreground",
        planeada: "border-transparent bg-status-planeada text-status-planeada-foreground",
        plantada: "border-transparent bg-status-plantada text-status-plantada-foreground",
        "parcial-planeada":
          "border-dashed border-status-planeada-foreground/50 bg-status-planeada/60 text-status-planeada-foreground",
        "plantada-parcial":
          "border-dashed border-status-plantada-foreground/50 bg-status-plantada/60 text-status-plantada-foreground",
        comprado: "border-transparent bg-secondary text-secondary-foreground",
        verde: "border-transparent bg-primary-soft text-primary",
        amarillo: "border-transparent bg-soil-soft text-soil-foreground",
        rojo: "border-transparent bg-destructive text-destructive-foreground",
        gris: "border-transparent bg-muted text-muted-foreground",
        urgente: "border-destructive bg-destructive-soft text-destructive",
        recibido: "border-transparent bg-primary-soft text-primary",
        pendiente: "border-transparent bg-soil-soft text-soil-foreground",
        cancelado: "border-transparent bg-destructive-soft text-destructive",
        parcial: "border-dashed border-soil bg-transparent text-soil-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
