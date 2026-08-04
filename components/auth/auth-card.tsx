import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface AuthCardProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function AuthCard({
  title,
  description,
  children,
  footer,
}: AuthCardProps) {
  return (
    <div className="w-full max-w-md">
      <Card className="border-border/70 shadow-sm">
        <CardHeader className="text-center space-y-1">
          <CardTitle className="text-2xl md:text-3xl tracking-tight">
            {title}
          </CardTitle>
          {description && (
            <CardDescription>{description}</CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-4">{children}</CardContent>
        {footer && (
          <CardFooter className="justify-center text-sm text-muted-foreground">
            {footer}
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
