import { Building2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Header() {
  return (
    <header className="w-full bg-primary border-b border-primary-foreground/10">
      <div className="max-w-[100rem] mx-auto px-8 lg:px-16 py-6 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3">
          <Building2 className="w-8 h-8 text-highlight" />
          <span className="font-heading text-2xl text-primary-foreground">
            Tri-State Directory
          </span>
        </Link>

        <nav className="flex items-center gap-8">
          <a 
            href="#directory" 
            className="font-heading text-base text-primary-foreground hover:text-highlight transition-colors"
          >
            Browse
          </a>
          <a 
            href="tel:123-456-7890" 
            className="font-heading text-sm text-primary-foreground border border-primary-foreground/20 px-6 py-2 hover:bg-highlight hover:text-secondary-foreground hover:border-highlight transition-colors"
          >
            Call Now: 123-456-7890
          </a>
        </nav>
      </div>
    </header>
  );
}
