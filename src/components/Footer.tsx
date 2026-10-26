import { Building2, Mail, Phone, MapPin } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="w-full bg-primary border-t border-primary-foreground/10 mt-20">
      <div className="max-w-[100rem] mx-auto px-8 lg:px-16 py-16">
        <div className="grid md:grid-cols-3 gap-12 mb-12">
          <div>
            <div className="flex items-center gap-3 mb-6">
              <Building2 className="w-8 h-8 text-highlight" />
              <span className="font-heading text-2xl text-primary-foreground">
                Tri-State Directory
              </span>
            </div>
            <p className="font-paragraph text-base text-primary-foreground/80 leading-relaxed">
              Your trusted source for discovering local businesses across the tri-state area. Connecting communities with quality services since 2026.
            </p>
          </div>

          <div>
            <h3 className="font-heading text-lg text-highlight mb-6">Quick Links</h3>
            <ul className="space-y-3">
              <li>
                <a href="#directory" className="font-paragraph text-base text-primary-foreground/80 hover:text-highlight transition-colors">
                  Browse Directory
                </a>
              </li>
              <li>
                <a href="#directory" className="font-paragraph text-base text-primary-foreground/80 hover:text-highlight transition-colors">
                  Search Businesses
                </a>
              </li>
              <li>
                <a href="#directory" className="font-paragraph text-base text-primary-foreground/80 hover:text-highlight transition-colors">
                  Categories
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-heading text-lg text-highlight mb-6">Contact Us</h3>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <Phone className="w-5 h-5 text-highlight mt-1 flex-shrink-0" />
                <a href="tel:123-456-7890" className="font-paragraph text-base text-primary-foreground/80 hover:text-highlight transition-colors">
                  123-456-7890
                </a>
              </li>
              <li className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-highlight mt-1 flex-shrink-0" />
                <a href="mailto:info@tristate-directory.com" className="font-paragraph text-base text-primary-foreground/80 hover:text-highlight transition-colors">
                  info@tristate-directory.com
                </a>
              </li>
              <li className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-highlight mt-1 flex-shrink-0" />
                <span className="font-paragraph text-base text-primary-foreground/80">
                  Serving NY, NJ, CT
                </span>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-primary-foreground/10 pt-8">
          <p className="font-paragraph text-sm text-primary-foreground/60 text-center">
            © 2026 Tri-State Directory. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
