/** @type {import('tailwindcss').Config} */
export default {
    content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}', './public/**/*.html'],
    theme: {
        extend: {
            fontFamily: {
                // UI / body
                sans: ['"Hanken Grotesk"', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
                // Editorial display serif for H1s and section headings only
                display: ['Fraunces', 'Georgia', '"Times New Roman"', 'serif'],
                // Verification-record / registry-ledger motif
                mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
                // Legacy aliases used by the generated template — keep mapped
                heading: ['Fraunces', 'Georgia', 'serif'],
                paragraph: ['"Hanken Grotesk"', 'sans-serif'],
            },
            fontSize: {
                xs: ['0.75rem', { lineHeight: '1.4' }],
                sm: ['0.875rem', { lineHeight: '1.5' }],
                base: ['1rem', { lineHeight: '1.5' }],
                lg: ['1.125rem', { lineHeight: '1.55' }],
                xl: ['1.25rem', { lineHeight: '1.45' }],
                '2xl': ['1.5rem', { lineHeight: '1.35', letterSpacing: '-0.01em' }],
                '3xl': ['1.875rem', { lineHeight: '1.25', letterSpacing: '-0.015em' }],
                '4xl': ['2.25rem', { lineHeight: '1.15', letterSpacing: '-0.02em' }],
                '5xl': ['3rem', { lineHeight: '1.08', letterSpacing: '-0.025em' }],
                '6xl': ['3.75rem', { lineHeight: '1.05', letterSpacing: '-0.025em' }],
            },
            colors: {
                // Token-backed palette — values live in src/styles/global.css
                paper: 'var(--paper)',
                surface: 'var(--surface)',
                inset: 'var(--inset)',
                ink: 'var(--ink)',
                muted: 'var(--muted)',
                faint: 'var(--faint)',
                brand: {
                    DEFAULT: 'var(--brand)',
                    deep: 'var(--brand-deep)',
                    wash: 'var(--brand-wash)',
                },
                accent: {
                    DEFAULT: 'var(--accent)',
                    hover: 'var(--accent-hover)',
                    ink: 'var(--accent-ink)',
                },
                ok: { DEFAULT: 'var(--ok)', wash: 'var(--ok-wash)' },
                warn: { DEFAULT: 'var(--warn)', wash: 'var(--warn-wash)' },
                danger: { DEFAULT: 'var(--danger)', wash: 'var(--danger-wash)' },
                line: {
                    DEFAULT: 'var(--line)',
                    strong: 'var(--line-strong)',
                },
                // Legacy template aliases (still referenced by unused demo files)
                highlight: 'var(--brand-wash)',
                foreground: 'var(--ink)',
                destructive: 'var(--danger)',
                destructiveforeground: '#FFFFFF',
                background: 'var(--paper)',
                secondary: 'var(--brand-wash)',
                'secondary-foreground': 'var(--ink)',
                'primary-foreground': '#FFFFFF',
                primary: 'var(--brand-deep)',
            },
            borderRadius: {
                card: '14px',
                chip: '999px',
            },
            maxWidth: {
                prose: '68ch',
            },
        },
    },
    future: {
        hoverOnlyWhenSupported: true,
    },
    plugins: [require('@tailwindcss/container-queries'), require('@tailwindcss/typography')],
}
