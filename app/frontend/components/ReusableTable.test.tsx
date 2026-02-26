import { render, screen, fireEvent } from '@testing-library/react';
import ReusableTable from './ReusableTable';

describe('ReusableTable', () => {
  const columns = [
    { key: 'id', label: 'ID' },
    { key: 'name', label: 'Name' },
    { key: 'age', label: 'Age' },
  ];

  const data = [
    { id: 1, name: 'Alice', age: 28 },
    { id: 2, name: 'Bob', age: 34 },
    { id: 3, name: 'Charlie', age: 22 },
    { id: 4, name: 'Diana', age: 30 },
    { id: 5, name: 'Eve', age: 25 },
    { id: 6, name: 'Frank', age: 40 },
  ];

  it('renders table headers and rows correctly', () => {
    render(<ReusableTable columns={columns} data={data} />);

    // Check headers
    columns.forEach((col) => {
      expect(screen.getByText(col.label)).toBeInTheDocument();
    });

    // Check rows
    data.slice(0, 5).forEach((row) => {
      expect(screen.getByText(row.name)).toBeInTheDocument();
    });
  });

  it('sorts data when a column header is clicked', () => {
    render(<ReusableTable columns={columns} data={data} />);

    const nameHeader = screen.getByText('Name');
    fireEvent.click(nameHeader);

    const rows = screen.getAllByRole('row');
    expect(rows[1]).toHaveTextContent('Alice');
    expect(rows[2]).toHaveTextContent('Bob');

    fireEvent.click(nameHeader);
    expect(rows[1]).toHaveTextContent('Frank');
    expect(rows[2]).toHaveTextContent('Eve');
  });

  it('paginates data correctly', () => {
    render(<ReusableTable columns={columns} data={data} />);

    const nextButton = screen.getByText('Next');
    fireEvent.click(nextButton);

    expect(screen.getByText('Frank')).toBeInTheDocument();
    expect(screen.queryByText('Alice')).not.toBeInTheDocument();

    const prevButton = screen.getByText('Previous');
    fireEvent.click(prevButton);

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.queryByText('Frank')).not.toBeInTheDocument();
  });
});