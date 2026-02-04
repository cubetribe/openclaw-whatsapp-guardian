# Contributing to WhatsApp Guardian

First off, thank you for considering contributing to WhatsApp Guardian! 🎉

It's people like you that make WhatsApp Guardian such a great tool for the AI agent community.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [How Can I Contribute?](#how-can-i-contribute)
- [Development Setup](#development-setup)
- [Style Guide](#style-guide)
- [Pull Request Process](#pull-request-process)

## 📜 Code of Conduct

This project and everyone participating in it is governed by our commitment to creating a welcoming and inclusive environment. By participating, you are expected to:

- Use welcoming and inclusive language
- Be respectful of differing viewpoints and experiences
- Gracefully accept constructive criticism
- Focus on what is best for the community
- Show empathy towards other community members

## 🚀 Getting Started

### Issues

- **Bug Reports**: Found a bug? Please create an issue with:
  - Clear title and description
  - Steps to reproduce
  - Expected vs actual behavior
  - Environment details (Node version, OS, etc.)

- **Feature Requests**: Have an idea? We'd love to hear it!
  - Describe the problem you're trying to solve
  - Explain your proposed solution
  - Consider alternatives you've thought about

- **Questions**: For general questions, please use GitHub Discussions.

### First-Time Contributors

Look for issues labeled:
- `good first issue` - Good for newcomers
- `help wanted` - Extra attention needed
- `documentation` - Documentation improvements

## 🛠️ How Can I Contribute?

### Bug Fixes

1. Check if the bug has already been reported
2. Create an issue if it hasn't
3. Fork the repo and create a branch: `git checkout -b fix/issue-123`
4. Make your changes
5. Write tests if applicable
6. Submit a PR

### New Features

1. Open an issue first to discuss the feature
2. Wait for approval/feedback
3. Fork and create a branch: `git checkout -b feature/awesome-feature`
4. Implement the feature
5. Add documentation
6. Submit a PR

### Documentation

Documentation improvements are always welcome! This includes:
- Fixing typos
- Clarifying existing docs
- Adding examples
- Translating docs

### Code Review

Reviewing PRs is a great way to contribute! Leave constructive feedback and help others improve their code.

## 💻 Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR-USERNAME/whatsapp-guardian.git
cd whatsapp-guardian

# Install dependencies
npm install

# Copy environment config
cp .env.example .env

# Run in development mode
npm run dev

# Type checking
npm run typecheck

# Build
npm run build
```

### Project Structure

```
src/
├── ai/           # AI classification
├── config/       # Configuration
├── inbox/        # Escalation writer
├── memory/       # SQLite store
├── outbox/       # Message processor
├── sanitizer/    # Input security
├── types/        # TypeScript types
├── utils/        # Utilities
├── web/          # QR web interface
├── webhook/      # HTTP notifications
└── whatsapp/     # Baileys client
```

## 📝 Style Guide

### TypeScript

- Use TypeScript for all new code
- Enable strict mode
- Define explicit types (avoid `any`)
- Use interfaces for objects
- Use enums for fixed sets of values

### Code Style

We use ESLint for code style. Key rules:
- 2 spaces for indentation
- Single quotes for strings
- Semicolons required
- No unused variables

### Naming Conventions

- **Files**: `kebab-case.ts`
- **Classes**: `PascalCase`
- **Functions/Variables**: `camelCase`
- **Constants**: `SCREAMING_SNAKE_CASE`
- **Types/Interfaces**: `PascalCase`

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): description

[optional body]

[optional footer]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting
- `refactor`: Code restructuring
- `test`: Adding tests
- `chore`: Maintenance

Examples:
```
feat(classifier): add support for custom intent types
fix(memory): prevent duplicate messages in history
docs(readme): add integration examples
```

## 🔄 Pull Request Process

1. **Update documentation** if your changes affect user-facing features
2. **Add tests** for new functionality
3. **Update CHANGELOG.md** with your changes
4. **Ensure CI passes** - all tests and linting
5. **Request review** from maintainers

### PR Title Format

Use the same format as commit messages:
```
feat(scope): description
```

### PR Description Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation

## Testing
How did you test these changes?

## Checklist
- [ ] Code follows style guide
- [ ] Self-reviewed
- [ ] Documented (if applicable)
- [ ] Tests added (if applicable)
```

## 🏷️ Issue Labels

- `bug` - Something isn't working
- `enhancement` - New feature request
- `documentation` - Documentation improvements
- `good first issue` - Good for newcomers
- `help wanted` - Extra attention needed
- `question` - Further information requested
- `wontfix` - Won't be worked on
- `duplicate` - Duplicate issue

## 🎉 Recognition

Contributors are recognized in:
- README.md contributors section
- Release notes
- GitHub contributors page

## 📫 Getting Help

- **GitHub Issues**: For bugs and features
- **GitHub Discussions**: For questions and ideas
- **Email**: maintainers@example.com

---

Thank you for contributing! 🙏
