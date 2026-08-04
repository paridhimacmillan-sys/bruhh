import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';
import { LanguageToggle, useLanguage } from '@/lib/language';

export default function NotFound() {
  const { text } = useLanguage();
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-6">
          <div className="mb-4 flex items-center justify-between gap-2"><div className="flex items-center gap-2">
            <AlertCircle className="h-8 w-8 text-red-500" />
            <h1 className="text-2xl font-bold text-gray-900">
              {text("404 Page Not Found", "404 ਸਫ਼ਾ ਨਹੀਂ ਮਿਲਿਆ", "404 पृष्ठ नहीं मिला")}
            </h1>
          </div><LanguageToggle /></div>

          <p className="mt-4 text-sm text-gray-600">
            {text("This page does not exist.", "ਇਹ ਸਫ਼ਾ ਮੌਜੂਦ ਨਹੀਂ ਹੈ।", "यह पृष्ठ मौजूद नहीं है।")}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
